"""
Two-pass AI processing per article:
  Call A — quality/verification (gates Call B)
  Call B — consumer-friendly summary
"""
import json
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.ai.client import call_claude
from app.ai.prompts import QUALITY_CHECK_PROMPT, ENRICH_PROMPT
from app.models.article import Article

logger = logging.getLogger(__name__)

MAX_CONTENT_CHARS = 3000
CONFIDENCE_REJECT_THRESHOLD = 2  # out of 5


def _truncate(text: str | None) -> str:
    if not text:
        return ""
    return text[:MAX_CONTENT_CHARS]


def _parse_json(text: str) -> dict:
    """Extract JSON from AI response, tolerating minor formatting."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return json.loads(text)


def process_article(article: Article, source_name: str, db: Session) -> None:
    """Run Call A then optionally Call B on a single article, updating it in-place."""
    content = _truncate(article.raw_content)

    # ── Call A: Quality / Verification ───────────────────────────────────────
    prompt_a = QUALITY_CHECK_PROMPT.format(
        title=article.title,
        source_name=source_name,
        content=content,
    )
    try:
        raw_a = call_claude(prompt_a, max_tokens=700)
        result_a = _parse_json(raw_a)
    except Exception as exc:
        logger.error("Call A failed for article %s: %s", article.id, exc)
        # On failure, send to human queue for manual review
        article.status = "pending_human"
        article.ai_processed = True
        article.ai_processed_at = datetime.utcnow()
        db.commit()
        return

    # Map scores (0-5) to normalized fields (0-1)
    src_q = float(result_a.get("source_quality_score", 0))
    cons_r = float(result_a.get("consumer_relevance_score", 0))
    novelty = float(result_a.get("novelty_score", 0))
    confidence = float(result_a.get("confidence_score", 0))

    article.quality_score = (src_q + confidence) / 10
    article.relevance_score = cons_r / 5
    article.impact_score = novelty / 5
    article.topic = result_a.get("topic") or None
    article.sentiment = result_a.get("sentiment") or "neutral"
    article.tags = json.dumps(result_a.get("tags") or [])
    article.is_scam = False
    article.flags = json.dumps(
        (result_a.get("risks_or_uncertainties") or []) +
        (result_a.get("editor_notes") or [])
    )

    decision = result_a.get("decision", "skip")

    # Reject if AI says skip or confidence too low
    if decision == "skip" or confidence < CONFIDENCE_REJECT_THRESHOLD:
        article.status = "rejected_ai"
        article.ai_processed = True
        article.ai_processed_at = datetime.utcnow()
        db.commit()
        logger.info(
            "Article %s rejected (decision=%s, confidence=%.0f)",
            article.id, decision, confidence,
        )
        return

    why_it_matters = result_a.get("why_it_matters_for_users", "")

    # ── Call B: Consumer Summary ──────────────────────────────────────────────
    prompt_b = ENRICH_PROMPT.format(
        title=article.title,
        source_name=source_name,
        content=content,
        why_it_matters=why_it_matters,
    )
    try:
        raw_b = call_claude(prompt_b, max_tokens=400)
        result_b = _parse_json(raw_b)
        article.summary = result_b.get("summary") or why_it_matters
        article.impact_score = float(result_b.get("impact_score", article.impact_score))
    except Exception as exc:
        logger.error("Call B failed for article %s: %s", article.id, exc)
        # Use Call A's why_it_matters as fallback summary
        article.summary = why_it_matters

    article.status = "pending_human"
    article.ai_processed = True
    article.ai_processed_at = datetime.utcnow()
    db.commit()

    logger.info(
        "Article %s processed: decision=%s topic=%s relevance=%.2f confidence=%.0f",
        article.id, decision, article.topic, article.relevance_score, confidence,
    )
