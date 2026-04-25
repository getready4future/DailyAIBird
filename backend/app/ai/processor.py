"""
Two-pass AI processing per article:
  Call A — quality gate (fast, ~350 tokens)
  Call B — full article rewrite (unchanged, 350-550 words)
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
CONFIDENCE_REJECT_THRESHOLD = 3


def _pipeline_cfg():
    from app.config_store import get_pipeline_config
    return get_pipeline_config()


def _get_prompt(key: str, default: str) -> str:
    from app.config_store import get_prompt
    override = get_prompt(key)
    return override if override else default


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


def process_article(article: Article, source_name: str, db: Session, *, context_prompt: str | None = None) -> None:
    """Run Call A then optionally Call B on a single article, updating it in-place."""
    from app.ai import progress

    content = _truncate(article.raw_content)

    # ── Announce analysis ─────────────────────────────────────────────────────
    progress.emit(
        article.title,
        kind="analyzing",
        url=article.url,
        source=source_name,
        image_url=article.image_url,
    )

    # ── Call A: Quality Gate ──────────────────────────────────────────────────
    prompt_a = _get_prompt("quality_check", QUALITY_CHECK_PROMPT).format(
        title=article.title,
        source_name=source_name,
        content=content,
    )
    try:
        raw_a = call_claude(prompt_a, max_tokens=400)
        result_a = _parse_json(raw_a)
    except Exception as exc:
        error_msg = f"AI Call A failed: {exc}"
        logger.error("Call A failed for article %d (%s): %s", article.id, article.title, exc)
        progress.emit(
            article.title, kind="error", url=article.url,
            detail=error_msg,
            source=source_name,
        )
        # Send to human review — do NOT silently reject; admin can see rejection_reason
        article.status = "pending_human"
        article.rejection_reason = error_msg
        article.ai_processed = True
        article.ai_processed_at = datetime.utcnow()
        db.commit()
        return

    src_q      = float(result_a.get("source_quality_score", 0))
    cons_r     = float(result_a.get("consumer_relevance_score", 0))
    confidence = float(result_a.get("confidence_score", 0))

    # quality_score = how confident AI is that this is a good, verifiable article (0–1)
    curiosity_raw = float(result_a.get("curiosity_score", 0))
    article.quality_score    = confidence / 5
    article.curiosity_score  = curiosity_raw / 5
    # relevance_score = weighted blend: reader relevance (60%) + source authority (40%)
    article.relevance_score  = (0.6 * cons_r + 0.4 * src_q) / 5
    article.topic            = result_a.get("topic") or None
    article.sentiment        = result_a.get("sentiment") or "neutral"
    article.flags            = json.dumps([])

    tags_raw = result_a.get("tags") or []
    if isinstance(tags_raw, str):
        tags_raw = [t.strip() for t in tags_raw.split(",") if t.strip()]
    article.tags = json.dumps(tags_raw)

    decision = result_a.get("decision", "skip")

    # ── Emit Call A scores ────────────────────────────────────────────────────
    progress.emit(
        article.title,
        kind="scored",
        url=article.url,
        topic=article.topic,
        decision=decision,
        quality=int(src_q),
        relevance=int(cons_r),
        confidence=int(confidence),
        core_claim=result_a.get("core_claim", ""),
    )

    # ── Reject if skip or confidence too low ──────────────────────────────────
    threshold = _pipeline_cfg().get("confidence_reject_threshold", CONFIDENCE_REJECT_THRESHOLD)
    if decision == "skip" or confidence < threshold:
        article.status = "rejected_ai"
        article.ai_processed = True
        article.ai_processed_at = datetime.utcnow()
        db.commit()
        progress.emit(
            article.title,
            kind="skipped",
            url=article.url,
            reason=f"decision={decision} · confidence {int(confidence)}/5",
        )
        logger.info("Article %s rejected (decision=%s, confidence=%.0f)", article.id, decision, confidence)
        return

    why_it_matters = result_a.get("why_it_matters_for_users", "")

    # ── Announce rewrite ──────────────────────────────────────────────────────
    progress.emit(article.title, kind="rewriting", url=article.url)

    # ── Call B: Full Article Rewrite (unchanged) ──────────────────────────────
    extra_instructions = f"\n\nSource-specific guidance: {context_prompt}" if context_prompt else ""
    prompt_b = _get_prompt("enrich", ENRICH_PROMPT).format(
        title=article.title,
        source_name=source_name,
        content=content,
        why_it_matters=why_it_matters,
    ) + extra_instructions
    try:
        raw_b = call_claude(prompt_b, max_tokens=1200)
        result_b = _parse_json(raw_b)
        if result_b.get("headline"):
            article.title = result_b["headline"]
        article.summary      = result_b.get("body") or result_b.get("lead") or why_it_matters
        article.impact_score = float(result_b.get("impact_score", 0.5))
    except Exception as exc:
        logger.error("Call B failed for article %d (%s): %s", article.id, article.title, exc)
        progress.emit(
            article.title, kind="error", url=article.url,
            detail=f"AI Call B failed (rewrite skipped): {exc}",
            source=source_name,
        )
        article.summary      = why_it_matters
        article.impact_score = cons_r / 5
        article.rejection_reason = f"AI Call B failed: {exc}"

    article.status           = "pending_human"
    article.ai_processed     = True
    article.ai_processed_at  = datetime.utcnow()
    db.commit()

    # ── Emit final result ─────────────────────────────────────────────────────
    preview = (article.summary or "")[:160].strip()
    progress.emit(
        article.title,
        kind="publish",
        url=article.url,
        topic=article.topic,
        decision=decision,
        confidence=int(confidence),
        image_url=article.image_url,
        preview=preview,
    )

    logger.info(
        "Article %s processed: topic=%s relevance=%.2f confidence=%.0f",
        article.id, article.topic, article.relevance_score, confidence,
    )
