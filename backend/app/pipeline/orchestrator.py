"""
Main pipeline runner:
  1. Scrape all active sources (parallel, semaphore-limited)
  2. Deduplicate
  3. AI process in batches (Call A → Call B)
  4. Flag featured articles
"""
import asyncio
import json
import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.ai.processor import process_article
from app.config import settings
from app.database import SessionLocal
from app.models.article import Article
from app.models.source import Source
from app.models.scrape_run import ScrapeRun
from app.pipeline.deduplicator import normalize_url, titles_are_similar
from app.scrapers import get_scraper, ScrapedArticle
from app.scrapers.sources_config import SOURCES

logger = logging.getLogger(__name__)

SCRAPE_SEMAPHORE = asyncio.Semaphore(5)
CUTOFF_HOURS = 48
FEATURE_MIN_SCORE = 0.75
TOP_FEATURED = 5


def _seed_sources(db: Session) -> None:
    """Ensure all sources from config exist in the database."""
    for cfg in SOURCES:
        existing = db.query(Source).filter(Source.slug == cfg["slug"]).first()
        if not existing:
            source = Source(
                name=cfg["name"],
                slug=cfg["slug"],
                url=cfg["url"],
                feed_url=cfg.get("feed_url"),
                scraper_type=cfg["scraper_type"],
                category=cfg["category"],
                scrape_config=json.dumps(cfg.get("scrape_config") or {}),
                is_active=cfg.get("is_active", True),
            )
            db.add(source)
    db.commit()


async def _scrape_source(source: Source, db: Session) -> tuple[int, int]:
    """Scrape one source and save new articles. Returns (found, new)."""
    cfg = {
        "slug": source.slug,
        "url": source.url,
        "feed_url": source.feed_url,
        "scraper_type": source.scraper_type,
        "scrape_config": json.loads(source.scrape_config or "{}"),
    }
    scraper = get_scraper(cfg)

    run = ScrapeRun(source_id=source.id, started_at=datetime.utcnow(), status="running")
    db.add(run)
    db.commit()

    cutoff = datetime.utcnow() - timedelta(hours=CUTOFF_HOURS)
    found = 0
    new = 0

    from app.ai import progress as _prog
    _prog.emit(f"{source.name} taranıyor…", kind="source_start", source=source.name)

    try:
        async with SCRAPE_SEMAPHORE:
            articles: list[ScrapedArticle] = await scraper.fetch_articles()

        found = len(articles)
        from app.config_store import get_max_articles_per_source
        global_max = get_max_articles_per_source()

        # Collect existing titles in DB for near-duplicate check
        existing_titles: list[str] = [
            a.title for a in db.query(Article.title)
            .filter(Article.source_id == source.id)
            .order_by(Article.created_at.desc())
            .limit(100)
            .all()
        ]

        max_articles = source.max_articles if source.max_articles is not None else global_max
        for article in articles[:max_articles]:
            # Skip old articles
            if article.published_at and article.published_at < cutoff:
                continue

            # URL dedup
            norm_url = normalize_url(article.url)
            exists = db.query(Article).filter(Article.url == article.url).first()
            if not exists:
                exists = db.query(Article).filter(Article.url == norm_url).first()
            if exists:
                continue

            # Title near-dedup
            if any(titles_are_similar(article.title, t) for t in existing_titles):
                logger.debug("Near-duplicate title skipped: %s", article.title)
                continue

            db_article = Article(
                source_id=source.id,
                url=article.url,
                title=article.title,
                author=article.author,
                published_at=article.published_at,
                raw_content=article.raw_content,
                external_id=article.external_id,
                tags=json.dumps(article.tags),
                image_url=article.image_url,
                status="pending_ai",
                ai_processed=False,
            )
            db.add(db_article)
            existing_titles.append(article.title)
            new += 1

            from app.ai import progress
            progress.emit(
                article.title,
                kind="found",
                url=article.url,
                source=source.name,
                image_url=article.image_url,
            )

        db.commit()

        run.status = "success"
        run.completed_at = datetime.utcnow()
        run.articles_found = found
        run.articles_new = new
        source.last_scraped_at = datetime.utcnow()
        db.commit()

        from app.ai import progress
        progress.emit(f"{source.name}: {new} yeni / {found} toplam", kind="scrape")
        logger.info("Scraped %s: %d found, %d new", source.name, found, new)

    except Exception as exc:
        run.status = "failed"
        run.error_message = str(exc)
        run.completed_at = datetime.utcnow()
        db.commit()
        logger.error("Scrape failed for %s: %s", source.name, exc)

    return found, new


async def _ai_process_pending(db: Session) -> int:
    """Process all pending_ai articles in batches. Returns count processed."""
    pending = (
        db.query(Article)
        .filter(Article.status == "pending_ai", Article.ai_processed.is_(False))
        .order_by(Article.created_at.desc())
        .limit(200)
        .all()
    )

    if not pending:
        return 0

    batch_size = settings.AI_BATCH_SIZE
    processed = 0

    for i in range(0, len(pending), batch_size):
        batch = pending[i: i + batch_size]
        for article in batch:
            source_name = article.source.name if article.source else "Unknown"
            context_prompt = article.source.context_prompt if article.source else None
            try:
                process_article(article, source_name, db, context_prompt=context_prompt)
                processed += 1
            except Exception as exc:
                logger.error("AI processing failed for article %d: %s", article.id, exc)
            # Yield to the event loop so SSE events are flushed between articles
            await asyncio.sleep(0.5)
        await asyncio.sleep(1)

    return processed


def _flag_featured(db: Session) -> None:
    """Mark top articles of the past 24h as featured."""
    cutoff = datetime.utcnow() - timedelta(hours=24)
    top = (
        db.query(Article)
        .filter(
            Article.status == "published",
            Article.relevance_score >= FEATURE_MIN_SCORE,
            Article.published_at >= cutoff,
        )
        .order_by(Article.relevance_score.desc())
        .limit(TOP_FEATURED)
        .all()
    )
    for article in top:
        article.is_featured = True
    db.commit()


async def run_scrape_pipeline(source_slug: str = "all") -> dict:
    """Entry point called by scheduler or admin endpoint."""
    from app.ai import progress

    db = SessionLocal()
    try:
        progress.start()
        _seed_sources(db)

        query = db.query(Source).filter(Source.is_active.is_(True))
        if source_slug != "all":
            query = query.filter(Source.slug == source_slug)
        sources = query.all()

        progress.emit(f"{len(sources)} kaynak taranacak…", kind="info")

        # Run all scrapes concurrently
        tasks = [_scrape_source(src, db) for src in sources]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        total_found = sum(r[0] for r in results if isinstance(r, tuple))
        total_new = sum(r[1] for r in results if isinstance(r, tuple))

        progress.emit(f"Toplam {total_new} yeni makale bulundu", kind="scrape")

        if total_new > 0:
            progress.emit("AI analizi başlıyor…", kind="info")

        # AI processing — async so sleeps yield to event loop (SSE flush)
        processed = await _ai_process_pending(db)

        _flag_featured(db)
        progress.finish()

        return {"sources_scraped": len(sources), "found": total_found, "new": total_new, "ai_processed": processed}
    except Exception as exc:
        progress.emit(f"Hata: {exc}", kind="error")
        progress.finish()
        raise
    finally:
        db.close()


def run_digest_pipeline() -> None:
    """Trigger digest generation for today (called by scheduler)."""
    from datetime import date
    from app.ai.digest_generator import generate_digest

    db = SessionLocal()
    try:
        generate_digest(date.today(), db)
    finally:
        db.close()
