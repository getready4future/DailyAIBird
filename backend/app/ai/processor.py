"""
Two-pass AI processing per article:
  Call A — quality/scam analysis (gates Call B)
  Call B — content enrichment (summary, topic, scores)
"""
import json
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.ai.client import call_claude
from app.ai.prompts import QUALITY_CHECK_PROMPT, ENRICH_PROMPT
from app.models.article import Article

logger = logging.getLogger(__name__)

QUALITY_REJECT_THRESHOLD = 0.4
MAX_CONTENT_CHARS = 3000


def _truncate(text: str | None) -> str:
    if not text:
        return ""
    return text[:MAX_CONTENT_CHARS]


def _parse_json(text: str) -> dict:
    """Extract JSON from Claude response, tolerating minor formatting."""
    text = text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return json.loads(text)


def process_article(article: Article, source_name: str, db: Session) -> None:
    """Run Call A then optionally Call B on a single article, updating it in-place."""
    content = _truncate(article.raw_content)

    # ── Call A: Quality / Scam Check ──────────────────────────────────────────
    prompt_a = QUALITY_CHECK_PROMPT.format(
        title=article.title,
        source_name=source_name,
        content=content,
    )
    try:
        raw_a = call_claude(prompt_a, max_tokens=512)
        result_a = _parse_json(raw_a)
    except Exception as exc:
        logger.error("Call A failed for article %s: %s", article.id, exc)
        article.status = "pending_human"
        article.ai_processed = True
        article.ai_processed_at = datetime.utcnow()
        db.commit()
        return

    article.quality_score = float(result_a.get("quality_score", 0.5))
    article.is_scam = bool(result_a.get("is_scam", False))
    article.scam_reason = result_a.get("scam_reason") or None
    article.flags = json.dumps(result_a.get("flags") or [])

    # Reject immediately if scam or too low quality
    if article.is_scam or article.quality_score < QUALITY_REJECT_THRESHOLD:
        article.status = "rejected_ai"
        article.ai_processed = True
        article.ai_processed_at = datetime.utcnow()
        db.commit()
        logger.info(
            "Article %s rejected by AI (scam=%s, quality=%.2f)",
            article.id, article.is_scam, article.quality_score,
        )
        return

    # ── Call B: Content Enrichment ────────────────────────────────────────────
    prompt_b = ENRICH_PROMPT.format(
        title=article.title,
        source_name=source_name,
        content=content,
    )
    try:
        raw_b = call_claude(prompt_b, max_tokens=600)
        result_b = _parse_json(raw_b)
    except Exception as exc:
        logger.error("Call B failed for article %s: %s", article.id, exc)
        # Still move to human queue with quality info but no enrichment
        article.status = "pending_human"
        article.ai_processed = True
        article.ai_processed_at = datetime.utcnow()
        db.commit()
        return

    article.summary = result_b.get("summary") or None
    article.topic = result_b.get("topic") or None
    article.relevance_score = float(result_b.get("relevance_score", 0.5))
    article.impact_score = float(result_b.get("impact_score", 0.5))
    article.sentiment = result_b.get("sentiment") or "neutral"
    article.tags = json.dumps(result_b.get("tags") or [])
    article.status = "pending_human"
    article.ai_processed = True
    article.ai_processed_at = datetime.utcnow()

    db.commit()
    logger.info(
        "Article %s processed: topic=%s relevance=%.2f quality=%.2f",
        article.id, article.topic, article.relevance_score, article.quality_score,
    )
