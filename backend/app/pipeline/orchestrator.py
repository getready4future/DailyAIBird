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
from app.pipeline.deduplicator import normalize_url, titles_are_similar, group_similar_titles
from app.scrapers import get_scraper, ScrapedArticle
from app.scrapers.sources_config import SOURCES

logger = logging.getLogger(__name__)

SCRAPE_SEMAPHORE = asyncio.Semaphore(5)

def _cfg():
    from app.config_store import get_pipeline_config
    return get_pipeline_config()

CUTOFF_HOURS = 48        # fallback used at module load; runtime uses _cfg()
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


async def _scrape_source(source_id: int) -> tuple[int, int]:
    """Scrape one source in an isolated DB session. Returns (found, new)."""
    from app.database import SessionLocal
    db = SessionLocal()
    source_name = f"source#{source_id}"
    run = None
    try:
        source = db.query(Source).filter(Source.id == source_id).first()
        if not source:
            return 0, 0
        source_name = source.name

        cfg = {
            "slug": source.slug,
            "url": source.url,
            "feed_url": source.feed_url,
            "scraper_type": source.scraper_type,
            "scrape_config": json.loads(source.scrape_config or "{}"),
            "etag": source.etag,
            "last_modified": source.last_modified,
        }
        scraper = get_scraper(cfg)

        run = ScrapeRun(source_id=source.id, started_at=datetime.utcnow(), status="running")
        db.add(run)
        db.commit()

        cutoff = datetime.utcnow() - timedelta(hours=_cfg().get("cutoff_hours", CUTOFF_HOURS))
        found = 0
        new = 0

        from app.ai import progress as _prog
        _prog.emit(f"Scraping {source.name}…", kind="source_start", source=source.name)

        _prog.emit("Fetching articles…", kind="fetch_start", source=source.name)
        async with SCRAPE_SEMAPHORE:
            articles: list[ScrapedArticle] = await scraper.fetch_articles()

        found = len(articles)
        _prog.emit(f"{found} articles fetched", kind="fetch_done", source=source.name, count=found)

        from app.config_store import get_max_articles_per_source
        global_max = get_max_articles_per_source()

        existing_titles: list[str] = [
            a.title for a in db.query(Article.title)
            .filter(Article.source_id == source.id)
            .order_by(Article.created_at.desc())
            .limit(100)
            .all()
        ]

        max_articles = source.max_articles if source.max_articles is not None else global_max
        skip_old = skip_url = skip_title = 0

        for article in articles[:max_articles]:
            if article.published_at and article.published_at < cutoff:
                skip_old += 1
                _prog.emit(article.title, kind="skip_old", source=source.name, url=article.url,
                           reason=f"Too old ({article.published_at.strftime('%d %b %H:%M') if article.published_at else '?'})")
                continue

            norm_url = normalize_url(article.url)
            exists = db.query(Article).filter(Article.url == article.url).first()
            if not exists:
                exists = db.query(Article).filter(Article.url == norm_url).first()
            if exists:
                skip_url += 1
                _prog.emit(article.title, kind="skip_url", source=source.name, url=article.url,
                           reason="URL already in database")
                continue

            if any(titles_are_similar(article.title, t) for t in existing_titles):
                skip_title += 1
                _prog.emit(article.title, kind="skip_title", source=source.name, url=article.url,
                           reason="Similar title already exists")
                logger.debug("Near-duplicate title skipped: %s", article.title)
                continue

            db_article = Article(
                source_id=source.id,
                url=article.url,
                title=article.title,
                original_title=article.title,  # preserve before Call B may overwrite
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

            _prog.emit(
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

        _prog.emit(
            f"{source.name}: {new} new · {skip_old} old · {skip_url} url-dup · {skip_title} title-dup",
            kind="source_done",
            source=source.name,
            new=new,
            skip_old=skip_old,
            skip_url=skip_url,
            skip_title=skip_title,
            total=found,
        )
        logger.info("Scraped %s: %d found, %d new", source.name, found, new)
        return found, new

    except Exception as exc:
        db.rollback()
        logger.error("Scrape failed for %s: %s", source_name, exc)
        if run is not None:
            try:
                run.status = "failed"
                run.error_message = str(exc)
                run.completed_at = datetime.utcnow()
                db.commit()
            except Exception:
                db.rollback()
        return 0, 0

    finally:
        db.close()


def _deduplicate_cross_source(db: Session) -> int:
    """Reject pending_ai articles that duplicate stories already seen (cross-source).

    Two-pass match (#6):
      1. Cheap lexical match (existing SequenceMatcher) at the user's threshold.
      2. Semantic token-cosine fallback at 0.78 — catches reordered/paraphrased headlines.
    """
    from app.pipeline.similarity import to_vector, cosine

    pending = (
        db.query(Article)
        .filter(Article.status == "pending_ai", Article.ai_processed.is_(False))
        .order_by(Article.created_at.asc())
        .all()
    )
    if not pending:
        return 0

    cfg = _cfg()
    recent_cutoff = datetime.utcnow() - timedelta(hours=cfg.get("cutoff_hours", 48))
    dedup_threshold = cfg.get("dedup_threshold", 0.65)
    semantic_threshold = cfg.get("semantic_dedup_threshold", 0.78)

    existing_titles: list[str] = [
        row[0] for row in db.query(Article.title).filter(
            Article.status.in_(["published", "pending_human"]),
            Article.created_at >= recent_cutoff,
        ).all()
    ]
    # Pre-compute vectors for the existing pool so we don't re-tokenize per pending article
    existing_vectors = [to_vector(t) for t in existing_titles]

    rejected = 0
    for article in pending:
        is_dup = any(titles_are_similar(article.title, t, threshold=dedup_threshold) for t in existing_titles)
        if not is_dup:
            article_vec = to_vector(article.title)
            for ev in existing_vectors:
                if cosine(article_vec, ev) >= semantic_threshold:
                    is_dup = True
                    break
        if is_dup:
            article.status = "rejected_ai"
            article.rejection_reason = "Cross-source duplicate"
            article.ai_processed = True
            article.ai_processed_at = datetime.utcnow()
            rejected += 1
        else:
            existing_titles.append(article.title)
            existing_vectors.append(to_vector(article.title))

    if rejected:
        db.commit()
        logger.info("Cross-source dedup rejected %d articles", rejected)

    return rejected


def _select_pending_round_robin(db: Session, run_limit: int) -> list[Article]:
    """Round-robin selection across sources so a fast source can't starve slow ones (#9).

    Also respects the retry queue: skips articles whose next_retry_at is in the future (#10).
    """
    now = datetime.utcnow()
    candidates = (
        db.query(Article)
        .filter(
            Article.status == "pending_ai",
            Article.ai_processed.is_(False),
            (Article.next_retry_at.is_(None)) | (Article.next_retry_at <= now),
        )
        .order_by(Article.created_at.desc())
        .all()
    )
    if not candidates:
        return []
    if len(candidates) <= run_limit:
        return candidates

    # Bucket per source
    buckets: dict[int, list[Article]] = {}
    for art in candidates:
        buckets.setdefault(art.source_id, []).append(art)

    # Round-robin pop until run_limit reached
    selected: list[Article] = []
    source_ids = list(buckets.keys())
    while len(selected) < run_limit and any(buckets.get(s) for s in source_ids):
        for sid in source_ids:
            if buckets.get(sid):
                selected.append(buckets[sid].pop(0))
                if len(selected) >= run_limit:
                    break
    return selected


async def _process_one_in_thread(article_id: int, source_name: str, context_prompt: str | None) -> bool:
    """Run process_article in a thread with its own DB session (parallel-safe)."""
    def _runner() -> bool:
        from app.database import SessionLocal
        db_local = SessionLocal()
        try:
            art = db_local.query(Article).filter(Article.id == article_id).first()
            if art is None:
                return False
            process_article(art, source_name, db_local, context_prompt=context_prompt)
            # If still pending_ai (transient failure), schedule exponential-backoff retry (#10)
            if art.status == "pending_ai" and art.ai_attempt_count and art.ai_attempt_count > 0:
                hours = min(48, 2 ** art.ai_attempt_count)
                art.next_retry_at = datetime.utcnow() + timedelta(hours=hours)
                db_local.commit()
            return True
        except Exception as exc:
            db_local.rollback()
            logger.error("AI processing failed for article %d: %s", article_id, exc)
            return False
        finally:
            db_local.close()
    return await asyncio.to_thread(_runner)


async def _ai_process_pending(db: Session) -> int:
    """Process pending_ai articles with parallelism + round-robin source selection.

    - #5: Inside a batch, articles run concurrently (Semaphore-bounded).
    - #9: Articles are selected round-robin per source so fast sources can't
          dominate the run budget.
    - #10: Articles whose next_retry_at is in the future are skipped.
    """
    run_limit = int(_cfg().get("max_articles_per_run", 200))
    pending = _select_pending_round_robin(db, run_limit)

    if not pending:
        return 0

    from app.ai import progress
    total = len(pending)
    batch_size = _cfg().get("ai_batch_size", settings.AI_BATCH_SIZE)
    concurrency = int(_cfg().get("ai_concurrency", 3))
    processed = 0

    progress.emit(f"Starting AI analysis for {total} articles", kind="ai_batch_start", total=total)

    semaphore = asyncio.Semaphore(concurrency)

    for i in range(0, total, batch_size):
        if progress.is_cancelled():
            progress.emit("AI analysis cancelled by user", kind="info")
            break
        batch = pending[i: i + batch_size]

        async def _gated(article: Article, idx: int) -> bool:
            if progress.is_cancelled():
                return False
            async with semaphore:
                source_name = article.source.name if article.source else "Unknown"
                context_prompt = article.source.context_prompt if article.source else None
                progress.emit(
                    article.title,
                    kind="ai_queue",
                    current=idx + 1,
                    total=total,
                    source=source_name,
                    url=article.url,
                )
                ok = await _process_one_in_thread(article.id, source_name, context_prompt)
                return ok

        results = await asyncio.gather(
            *[_gated(art, i + j) for j, art in enumerate(batch)],
            return_exceptions=True,
        )
        processed += sum(1 for r in results if r is True)
        await asyncio.sleep(0.5)

    return processed


def _flag_featured(db: Session) -> None:
    """Mark top articles of the past 24h as featured.

    Ranking combines:
      - relevance / impact / curiosity / momentum (the existing axes)
      - recency decay: 1.0 for fresh, 0.85 for 24h-old (linear)
      - topic diversity cap: max 2 featured articles per topic
    """
    cfg = _cfg()
    now = datetime.utcnow()
    cutoff = now - timedelta(hours=24)
    feature_min = cfg.get("feature_min_score", FEATURE_MIN_SCORE)
    top_n = cfg.get("top_featured", TOP_FEATURED)
    max_per_topic = cfg.get("max_featured_per_topic", 2)

    # Pull the candidate pool — broader than top_n so diversity cap has options.
    candidates = (
        db.query(Article)
        .filter(
            Article.status == "published",
            Article.published_at >= cutoff,
        )
        .all()
    )

    def score(a: Article) -> float:
        relevance = a.relevance_score or 0.0
        impact = a.impact_score or 0.0
        curiosity = a.curiosity_score or 0.0
        # Recency decay: 1.0 at now, 0.85 at 24h boundary, linear
        if a.published_at:
            age_hours = max(0.0, (now - a.published_at).total_seconds() / 3600.0)
            recency = 1.0 - (min(age_hours, 24.0) / 24.0) * 0.15
        else:
            recency = 0.85
        # #8: Cluster size as multiplicative trend boost. Single source = 1.0,
        # 5+ sources = 1.4. Replaces the previous 0.15-weighted additive term.
        cluster_size = max(1, a.momentum_score or 1)
        cluster_boost = 1.0 + min(cluster_size - 1, 4) * 0.1
        base = relevance * 0.40 + impact * 0.30 + curiosity * 0.30
        return base * recency * cluster_boost

    scored = [(a, score(a)) for a in candidates]
    scored = [(a, s) for (a, s) in scored if s >= feature_min]
    scored.sort(key=lambda t: t[1], reverse=True)

    # Topic diversity cap
    selected: list[Article] = []
    per_topic: dict[str, int] = {}
    for article, _ in scored:
        topic_key = article.topic or "_untagged"
        if per_topic.get(topic_key, 0) >= max_per_topic:
            continue
        selected.append(article)
        per_topic[topic_key] = per_topic.get(topic_key, 0) + 1
        if len(selected) >= top_n:
            break

    # Reset previous featured flags within the window so the set stays current.
    db.query(Article).filter(
        Article.is_featured.is_(True),
        Article.published_at >= cutoff,
    ).update({Article.is_featured: False}, synchronize_session=False)

    for article in selected:
        article.is_featured = True
    db.commit()


async def run_scrape_pipeline(source_slug: str = "all", run_id: int | None = None) -> dict:
    """Entry point called by scheduler or admin endpoint.

    If run_id is provided, the caller has already created the PipelineRun row
    and we just attach to it. Otherwise we create a new one.
    """
    from app.ai import progress
    from app.models.pipeline_run import PipelineRun

    db = SessionLocal()
    pipeline_run: PipelineRun | None = None
    cancelled = False
    try:
        if run_id is not None:
            pipeline_run = db.query(PipelineRun).filter(PipelineRun.id == run_id).first()
        if pipeline_run is None:
            pipeline_run = PipelineRun(
                started_at=datetime.utcnow(),
                status="running",
                source_slug=source_slug,
            )
            db.add(pipeline_run)
            db.flush()
            db.commit()
        run_id = pipeline_run.id

        progress.start(run_id)
        progress.emit(f"Pipeline started (run #{run_id})", kind="info")

        _seed_sources(db)

        query = db.query(Source).filter(Source.is_active.is_(True))
        if source_slug != "all":
            query = query.filter(Source.slug == source_slug)
        sources = query.all()

        progress.emit(f"Scraping {len(sources)} sources…", kind="info")

        # Run all scrapes concurrently — each source gets its own DB session
        tasks = [_scrape_source(src.id) for src in sources]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        total_found = sum(r[0] for r in results if isinstance(r, tuple))
        total_new = sum(r[1] for r in results if isinstance(r, tuple))

        progress.emit(f"{total_new} new articles found across all sources", kind="scrape")

        if progress.is_cancelled():
            progress.emit("Pipeline cancelled — skipping AI analysis", kind="info")
            cancelled = True
        elif total_new > 0:
            deduped = _deduplicate_cross_source(db)
            if deduped:
                progress.emit(f"{deduped} cross-source duplicates removed", kind="info")

            from app.pipeline.clustering import cluster_pending_articles
            clustered = cluster_pending_articles(db)
            if clustered:
                progress.emit(f"{clustered} articles grouped into story clusters", kind="info")

            progress.emit("Starting AI analysis…", kind="info")

        processed = 0
        if not cancelled and not progress.is_cancelled():
            processed = await _ai_process_pending(db)
        if progress.is_cancelled():
            cancelled = True

        if not cancelled:
            _flag_featured(db)

            # Refresh source health + auto-disable chronic failures (#2)
            try:
                from app.pipeline.source_health import recompute_source_health
                disabled = recompute_source_health(db)
                if disabled:
                    progress.emit(f"{disabled} source(s) auto-disabled due to chronic failures",
                                  kind="info")
            except Exception as exc:
                logger.warning("Source health recompute failed: %s", exc)

        if pipeline_run is not None:
            in_tok, out_tok = progress.get_usage(run_id)
            pipeline_run.status = "cancelled" if cancelled else "success"
            pipeline_run.completed_at = datetime.utcnow()
            pipeline_run.total_found = total_found
            pipeline_run.total_new = total_new
            pipeline_run.total_ai_processed = processed
            pipeline_run.input_tokens = in_tok
            pipeline_run.output_tokens = out_tok

            # Run-to-run regression alert (#3)
            if not cancelled:
                try:
                    from app.pipeline.source_health import detect_run_anomaly
                    anomaly = detect_run_anomaly(db, pipeline_run)
                    if anomaly:
                        progress.emit(anomaly, kind="anomaly")
                        # Stash on the run row so the admin UI can flag it red
                        existing = pipeline_run.error_message or ""
                        pipeline_run.error_message = (existing + "\n" if existing else "") + anomaly
                except Exception as exc:
                    logger.warning("Anomaly detection failed: %s", exc)

            db.commit()

        progress.finish(run_id)

        return {
            "sources_scraped": len(sources),
            "found": total_found,
            "new": total_new,
            "ai_processed": processed,
            "cancelled": cancelled,
        }
    except Exception as exc:
        db.rollback()
        if pipeline_run is not None:
            try:
                in_tok, out_tok = progress.get_usage(pipeline_run.id)
                pipeline_run.status = "failed"
                pipeline_run.completed_at = datetime.utcnow()
                pipeline_run.error_message = str(exc)
                pipeline_run.input_tokens = in_tok
                pipeline_run.output_tokens = out_tok
                db.commit()
            except Exception:
                db.rollback()
        progress.emit(f"Error: {exc}", kind="error")
        if pipeline_run is not None:
            progress.finish(pipeline_run.id)
        raise
    finally:
        db.close()


def run_digest_pipeline() -> None:
    """Trigger digest generation for today (called by scheduler).

    Wrapped in a PipelineRun + progress lifecycle (#11) so digest runs are
    visible in the admin monitor alongside scrape runs, and crashes leave
    a recorded failure rather than silent void.
    """
    from datetime import date
    from app.ai.digest_generator import generate_digest
    from app.ai import progress
    from app.models.pipeline_run import PipelineRun

    db = SessionLocal()
    pipeline_run: PipelineRun | None = None
    try:
        pipeline_run = PipelineRun(
            started_at=datetime.utcnow(),
            status="running",
            source_slug="digest",
        )
        db.add(pipeline_run)
        db.commit()
        db.refresh(pipeline_run)
        progress.start(pipeline_run.id)
        progress.emit(f"Digest pipeline started (run #{pipeline_run.id})", kind="info")

        digest = generate_digest(date.today(), db)
        if digest is None:
            progress.emit("Digest generation produced no output (no published articles?)", kind="error")
        else:
            progress.emit(
                f"Digest generated: {digest.headline[:80] if digest.headline else digest.id}",
                kind="publish",
            )

        in_tok, out_tok = progress.get_usage(pipeline_run.id)
        pipeline_run.status = "success" if digest is not None else "failed"
        pipeline_run.completed_at = datetime.utcnow()
        pipeline_run.input_tokens = in_tok
        pipeline_run.output_tokens = out_tok
        if digest is None:
            pipeline_run.error_message = "No digest produced"
        db.commit()
        progress.finish(pipeline_run.id)
    except Exception as exc:
        db.rollback()
        if pipeline_run is not None:
            try:
                in_tok, out_tok = progress.get_usage(pipeline_run.id)
                pipeline_run.status = "failed"
                pipeline_run.completed_at = datetime.utcnow()
                pipeline_run.error_message = str(exc)
                pipeline_run.input_tokens = in_tok
                pipeline_run.output_tokens = out_tok
                db.commit()
            except Exception:
                db.rollback()
        progress.emit(f"Digest error: {exc}", kind="error")
        if pipeline_run is not None:
            progress.finish(pipeline_run.id)
        raise
    finally:
        db.close()
