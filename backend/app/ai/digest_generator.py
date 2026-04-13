import json
import logging
from datetime import date, datetime

from sqlalchemy.orm import Session

from app.ai.client import call_claude, MODEL
from app.ai.prompts import DIGEST_PROMPT
from app.models.article import Article
from app.models.daily_digest import DailyDigest, DigestArticle

logger = logging.getLogger(__name__)

TOP_N = 20


def generate_digest(target_date: date, db: Session) -> DailyDigest | None:
    """Generate and save the daily digest for target_date from published articles."""
    # Fetch top published articles from the last 48h by relevance
    from datetime import timedelta
    cutoff = datetime.combine(target_date - timedelta(days=1), datetime.min.time())

    articles: list[Article] = (
        db.query(Article)
        .filter(
            Article.status == "published",
            Article.published_at >= cutoff,
            Article.summary.isnot(None),
        )
        .order_by(Article.relevance_score.desc())
        .limit(TOP_N)
        .all()
    )

    if not articles:
        logger.warning("No published articles found for digest %s", target_date)
        return None

    articles_payload = [
        {
            "title": a.title,
            "url": a.url,
            "summary": a.summary,
            "topic": a.topic,
            "source": a.source.name if a.source else "Unknown",
            "relevance_score": a.relevance_score,
        }
        for a in articles
    ]

    prompt = DIGEST_PROMPT.format(
        date=target_date.isoformat(),
        articles_json=json.dumps(articles_payload, indent=2),
    )

    try:
        raw = call_claude(prompt, max_tokens=2000)
        result = json.loads(raw.strip())
    except Exception as exc:
        logger.error("Digest generation failed for %s: %s", target_date, exc)
        return None

    # Upsert digest record
    digest = db.query(DailyDigest).filter(DailyDigest.digest_date == target_date).first()
    if digest:
        # Re-generate: reset approval
        digest.status = "pending_review"
        digest.approved_by = None
        digest.approved_at = None
    else:
        digest = DailyDigest(digest_date=target_date)
        db.add(digest)

    digest.headline = result.get("headline", "")
    digest.intro = result.get("intro", "")
    digest.sections = json.dumps(result.get("sections", []))
    digest.article_count = len(articles)
    digest.model_used = MODEL
    digest.generated_at = datetime.utcnow()

    db.flush()

    # Link articles (clear old links first)
    db.query(DigestArticle).filter(DigestArticle.digest_id == digest.id).delete()
    for rank, article in enumerate(articles):
        db.add(DigestArticle(digest_id=digest.id, article_id=article.id, rank=rank))

    # Set top story
    digest.top_story_id = articles[0].id if articles else None
    db.commit()

    logger.info("Digest for %s generated: %d articles, headline: %s", target_date, len(articles), digest.headline)
    return digest
