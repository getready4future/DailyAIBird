"""
Two-pass AI processing per article (hardened for small / open-weight models):

  Call A — Quality Gate (low temperature, few-shot, JSON retry)
  Call B1 — Faithful Rewrite (very low temperature, fidelity-only)
  Call B2 — Voice & Accessibility Polish (low temperature, style-only)

Each LLM call is wrapped with:
  - JSON parse retry (1 attempt with explicit "valid JSON only" follow-up)
  - Banned-word post-filter (regex scan; one rewrite retry if hits)
  - Output length validator (Call B1; one rewrite retry if outside 350-550)
  - Numeric claim verification (claims not in source → pending_human)

Failed articles are tracked via `ai_attempt_count`. After 3 attempts they are
quarantined as `failed_ai` so they don't loop forever.
"""
import json
import logging
import re
from datetime import datetime

from sqlalchemy.orm import Session

from app.ai.client import call_claude
from app.ai.prompt_registry import pick_prompt, record_use
from app.ai.prompts import QUALITY_CHECK_PROMPT, REWRITE_PROMPT, POLISH_PROMPT, ENRICH_PROMPT
from app.models.article import Article

logger = logging.getLogger(__name__)

MAX_CONTENT_CHARS = 3000
CONFIDENCE_REJECT_THRESHOLD = 3
MAX_AI_ATTEMPTS = 3

# Temperatures tuned per-call for small models (Gemma-class):
TEMP_QUALITY = 0.2     # gate decisions should be stable
TEMP_REWRITE = 0.2     # fidelity > creativity
TEMP_POLISH  = 0.4     # some room for voice tightening

BODY_MIN_WORDS = 350
BODY_MAX_WORDS = 550

# Banned vocabulary used by the post-filter — kept in sync with POLISH_PROMPT.
BANNED_WORDS = [
    "delve", "leverage", "utilize", "harness", "streamline", "foster", "empower",
    "navigate", "facilitate", "pivotal", "robust", "crucial", "comprehensive",
    "meticulous", "intricate", "dynamic", "holistic", "multifaceted", "transformative",
    "seamless", "innovative", "commendable", "groundbreaking", "game-changing",
    "unprecedented", "revolutionary", "cutting-edge", "state-of-the-art",
    "tapestry", "synergy", "testament", "interplay", "underpinnings", "paradigm",
    "furthermore", "moreover", "consequently", "additionally",
    "highlights", "underscores", "demonstrates", "showcases",
]
_BANNED_RE = re.compile(r"\b(" + "|".join(re.escape(w) for w in BANNED_WORDS) + r")\b", re.IGNORECASE)


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


def _strip_fences(text: str) -> str:
    """Remove markdown fences and leading/trailing junk that small models often add."""
    text = text.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        # drop first fence line and (optional) trailing fence line
        text = "\n".join(lines[1:-1] if lines and lines[-1].strip() == "```" else lines[1:])
    return text.strip()


def _parse_json(text: str) -> dict:
    """Tolerant JSON parser. Drops scratchpad fields if present."""
    text = _strip_fences(text)
    # Find the first '{' and last '}' as a fallback for runaway prose
    if not text.startswith("{"):
        first = text.find("{")
        last = text.rfind("}")
        if first != -1 and last != -1 and last > first:
            text = text[first:last + 1]
    obj = json.loads(text)
    obj.pop("_thinking", None)
    return obj


def _call_with_json_retry(
    prompt: str, max_tokens: int, temperature: float, label: str,
) -> tuple[dict, bool]:
    """One LLM call, with one automatic retry if JSON parsing fails.

    Returns (parsed_dict, retried_due_to_json_error).
    """
    raw = call_claude(prompt, max_tokens=max_tokens, temperature=temperature)
    try:
        return _parse_json(raw), False
    except Exception as exc:
        logger.warning("%s: JSON parse failed (%s) — retrying", label, exc)
        retry_prompt = (
            prompt
            + "\n\nYour previous response was not valid JSON. "
              "Reply ONLY with the JSON object — no markdown fences, no preamble, no text after."
        )
        raw2 = call_claude(retry_prompt, max_tokens=max_tokens, temperature=temperature)
        return _parse_json(raw2), True


def _word_count(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text or ""))


def _find_banned(text: str) -> list[str]:
    return list({m.group(1).lower() for m in _BANNED_RE.finditer(text or "")})


def _extract_numeric_claims(text: str) -> list[str]:
    """Pull numeric tokens (with units) from output for source verification."""
    if not text:
        return []
    # Number with optional thousands separator and decimal, then optional unit suffix.
    pattern = re.compile(
        r"\b\d{1,3}(?:[,\.]\d{3})*(?:\.\d+)?\s*(?:%|million|billion|thousand|trillion|x\b|k\b|m\b|b\b)?",
        re.IGNORECASE,
    )
    raw = [m.group(0).strip() for m in pattern.finditer(text)]
    # Filter out trivial standalones (1-digit unaccompanied) which are usually noise
    out = []
    for tok in raw:
        digits_only = re.sub(r"[^\d]", "", tok)
        if len(digits_only) >= 2 or "%" in tok:
            out.append(tok)
    return out


def _claim_in_source(claim: str, source: str) -> bool:
    """Loose substring match — catches verbatim figures the model may have echoed."""
    if not claim:
        return True
    src_norm = source.lower().replace(",", "")
    claim_norm = claim.lower().replace(",", "")
    digits = re.sub(r"[^\d.]", "", claim_norm)
    if digits and digits in re.sub(r"[^\d.]", "", src_norm):
        return True
    return claim_norm in src_norm


def _verify_numeric_claims(body: str, source: str) -> list[str]:
    """Return numeric claims in the body that don't appear in the source (potential hallucinations)."""
    return [c for c in _extract_numeric_claims(body) if not _claim_in_source(c, source)]


# ── Call A: Quality Gate ──────────────────────────────────────────────────────

def _run_quality_gate(article: Article, source_name: str, content: str) -> tuple[dict, int | None, bool]:
    """Returns (result, prompt_version_id, json_retry_happened)."""
    template, version_id = pick_prompt("quality_check", article.id, QUALITY_CHECK_PROMPT)
    prompt = template.format(
        title=article.title,
        source_name=source_name,
        content=content,
    )
    result, retried = _call_with_json_retry(prompt, max_tokens=600, temperature=TEMP_QUALITY, label="Call A")
    return result, version_id, retried


# ── Call B1: Faithful Rewrite ─────────────────────────────────────────────────

def _run_rewrite(article: Article, source_name: str, content: str, why_it_matters: str,
                 context_prompt: str | None) -> tuple[dict, int | None, bool]:
    """Returns (result, prompt_version_id, json_retry_happened)."""
    template, version_id = pick_prompt("rewrite", article.id, REWRITE_PROMPT)
    extra = f"\n\nSource-specific guidance: {context_prompt}" if context_prompt else ""
    prompt = template.format(
        title=article.title,
        source_name=source_name,
        content=content,
        why_it_matters=why_it_matters,
    ) + extra

    result, retried1 = _call_with_json_retry(prompt, max_tokens=1500, temperature=TEMP_REWRITE, label="Call B1")

    # Length validator — one retry if out of range
    body = result.get("body", "") or ""
    wc = _word_count(body)
    retried2 = False
    if not (BODY_MIN_WORDS <= wc <= BODY_MAX_WORDS):
        logger.warning("Call B1: body is %d words (target %d-%d) — retrying", wc, BODY_MIN_WORDS, BODY_MAX_WORDS)
        length_prompt = (
            prompt
            + f"\n\nYour previous output was {wc} words. The required range is "
              f"{BODY_MIN_WORDS}-{BODY_MAX_WORDS} words. Rewrite the body to fit. "
              "Keep all facts unchanged. Return only the JSON object."
        )
        result, retried2 = _call_with_json_retry(length_prompt, max_tokens=1500, temperature=TEMP_REWRITE, label="Call B1 (length retry)")

    return result, version_id, (retried1 or retried2)


# ── Call B2: Voice & Accessibility Polish ─────────────────────────────────────

def _run_polish(article_id: int, rewrite_result: dict) -> tuple[dict, int | None, bool, bool]:
    """Returns (result, prompt_version_id, json_retry_happened, banned_word_retry_happened)."""
    template, version_id = pick_prompt("polish", article_id, POLISH_PROMPT)
    prompt = template.format(
        headline=rewrite_result.get("headline", ""),
        body=rewrite_result.get("body", ""),
        lead=rewrite_result.get("lead", ""),
    )
    result, retried_json1 = _call_with_json_retry(prompt, max_tokens=1500, temperature=TEMP_POLISH, label="Call B2")

    # Banned-word post-filter — one retry if hits
    body = result.get("body", "") or ""
    hits = _find_banned(body)
    banned_retry = False
    retried_json2 = False
    if hits:
        logger.warning("Call B2: banned words present (%s) — retrying", ", ".join(hits))
        banned_retry = True
        retry_prompt = (
            prompt
            + f"\n\nYour previous output contained these forbidden words: {', '.join(hits)}. "
              "Rewrite removing every instance. Keep all facts unchanged. Return only the JSON object."
        )
        result, retried_json2 = _call_with_json_retry(retry_prompt, max_tokens=1500, temperature=TEMP_POLISH, label="Call B2 (banned-word retry)")

    return result, version_id, (retried_json1 or retried_json2), banned_retry


# ── Main orchestrator ─────────────────────────────────────────────────────────

def process_article(article: Article, source_name: str, db: Session, *, context_prompt: str | None = None) -> None:
    """Run Call A → Call B1 → Call B2 on a single article, updating it in-place."""
    from app.ai import progress

    if progress.is_cancelled():
        return

    content = _truncate(article.raw_content)

    # Increment attempt counter up front; quarantine if exceeded
    article.ai_attempt_count = (article.ai_attempt_count or 0) + 1
    if article.ai_attempt_count > MAX_AI_ATTEMPTS:
        article.status = "failed_ai"
        article.ai_processed = True
        article.ai_processed_at = datetime.utcnow()
        article.rejection_reason = f"AI quarantine after {MAX_AI_ATTEMPTS} failed attempts"
        db.commit()
        progress.emit(
            article.title, kind="skipped", url=article.url,
            reason=f"Quarantined after {MAX_AI_ATTEMPTS} failed AI attempts",
        )
        return
    db.commit()

    progress.emit(
        article.title, kind="analyzing",
        url=article.url, source=source_name, image_url=article.image_url,
    )

    # ── Call A ───────────────────────────────────────────────────────────────
    progress.emit(article.title, kind="call_a_start", source=source_name, url=article.url)
    t_a = datetime.utcnow()
    qa_version_id: int | None = None
    qa_json_retry = False
    try:
        result_a, qa_version_id, qa_json_retry = _run_quality_gate(article, source_name, content)
    except Exception as exc:
        error_msg = f"AI Call A failed: {exc}"
        logger.error("Call A failed for article %d (%s): %s", article.id, article.title, exc)
        progress.emit(article.title, kind="error", url=article.url, detail=error_msg, source=source_name)
        article.rejection_reason = error_msg
        article.ai_processed_at = datetime.utcnow()
        # Leave status as pending_ai so it can be retried (or quarantined on next attempt)
        db.commit()
        return

    src_q      = float(result_a.get("source_quality_score", 0))
    cons_r     = float(result_a.get("consumer_relevance_score", 0))
    confidence = float(result_a.get("confidence_score", 0))
    curiosity_raw = float(result_a.get("curiosity_score", 0))

    article.quality_score   = confidence / 5
    article.curiosity_score = curiosity_raw / 5
    article.relevance_score = (0.6 * cons_r + 0.4 * src_q) / 5
    article.topic           = result_a.get("topic") or None
    article.sentiment       = result_a.get("sentiment") or "neutral"
    article.flags           = json.dumps([])

    tags_raw = result_a.get("tags") or []
    if isinstance(tags_raw, str):
        tags_raw = [t.strip() for t in tags_raw.split(",") if t.strip()]
    article.tags = json.dumps(tags_raw)

    decision = result_a.get("decision", "skip")
    elapsed_a = round((datetime.utcnow() - t_a).total_seconds(), 1)

    progress.emit(
        article.title, kind="scored",
        url=article.url, topic=article.topic, decision=decision,
        quality=int(src_q), relevance=int(cons_r),
        confidence=int(confidence), curiosity=int(curiosity_raw),
        core_claim=result_a.get("core_claim", ""),
        why_it_matters=result_a.get("why_it_matters_for_users", ""),
        elapsed=elapsed_a,
    )

    threshold = _pipeline_cfg().get("confidence_reject_threshold", CONFIDENCE_REJECT_THRESHOLD)
    if decision == "skip" or confidence < threshold:
        article.status = "rejected_ai"
        article.ai_processed = True
        article.ai_processed_at = datetime.utcnow()
        db.commit()
        # A/B telemetry: Call A used, didn't pass downstream → no pass increment
        record_use(qa_version_id, passed=False, json_retry=qa_json_retry)
        progress.emit(
            article.title, kind="skipped", url=article.url,
            reason=f"decision={decision} · confidence {int(confidence)}/5",
        )
        logger.info("Article %s rejected (decision=%s, confidence=%.0f)", article.id, decision, confidence)
        return

    if progress.is_cancelled():
        return

    why_it_matters = result_a.get("why_it_matters_for_users", "")

    # ── Call B1: Faithful Rewrite ────────────────────────────────────────────
    t_b = datetime.utcnow()
    progress.emit(article.title, kind="rewriting", url=article.url, source=source_name)

    # Optional admin override: if a custom "enrich" prompt is set, bypass the two-pass flow
    # and run the legacy single-call path so users with curated overrides aren't surprised.
    legacy_override_active = False
    try:
        from app.config_store import get_prompt as _get_override
        legacy_override_active = bool(_get_override("enrich"))
    except Exception:
        pass

    rewrite_result: dict = {}
    polish_result: dict = {}
    rewrite_version_id: int | None = None
    polish_version_id: int | None = None
    rewrite_json_retry = False
    polish_json_retry = False
    polish_banned_retry = False
    try:
        if legacy_override_active:
            # Single-call legacy path
            extra = f"\n\nSource-specific guidance: {context_prompt}" if context_prompt else ""
            legacy_prompt = _get_prompt("enrich", ENRICH_PROMPT).format(
                title=article.title, source_name=source_name,
                content=content, why_it_matters=why_it_matters,
            ) + extra
            polish_result, _retried = _call_with_json_retry(
                legacy_prompt, max_tokens=1500, temperature=TEMP_REWRITE, label="Call B (legacy)",
            )
            rewrite_result = polish_result  # for impact_score below
        else:
            rewrite_result, rewrite_version_id, rewrite_json_retry = _run_rewrite(
                article, source_name, content, why_it_matters, context_prompt,
            )
            polish_result, polish_version_id, polish_json_retry, polish_banned_retry = _run_polish(
                article.id, rewrite_result,
            )
    except Exception as exc:
        logger.error("Call B failed for article %d (%s): %s", article.id, article.title, exc)
        progress.emit(
            article.title, kind="error", url=article.url,
            detail=f"AI Call B failed (rewrite skipped): {exc}", source=source_name,
        )
        article.summary = why_it_matters
        article.impact_score = cons_r / 5
        article.rejection_reason = f"AI Call B failed: {exc}"
        article.ai_processed = True
        article.ai_processed_at = datetime.utcnow()
        # Leave status as pending_ai so it gets retried next run (or quarantined)
        db.commit()
        return

    final_headline = polish_result.get("headline") or rewrite_result.get("headline") or article.title
    final_body = polish_result.get("body") or rewrite_result.get("body") or why_it_matters
    final_lead = polish_result.get("lead") or rewrite_result.get("lead") or ""
    impact = float(rewrite_result.get("impact_score", polish_result.get("impact_score", 0.5)))

    # ── Hallucination guard: numeric claim verification ──────────────────────
    missing = _verify_numeric_claims(final_body, content)
    if missing:
        logger.warning(
            "Article %d: %d numeric claims not found in source: %s — routing to human review",
            article.id, len(missing), missing[:5],
        )
        if not article.original_title:
            article.original_title = article.title  # legacy backfill — first overwrite preserves it
        article.title = final_headline
        article.summary = final_body
        article.impact_score = impact
        article.status = "pending_human"
        article.ai_processed = True
        article.ai_processed_at = datetime.utcnow()
        article.rejection_reason = f"Numeric claims not in source: {', '.join(missing[:5])}"
        db.commit()
        # A/B telemetry: numeric-fail counts as use but not as pass
        record_use(qa_version_id, passed=False, json_retry=qa_json_retry)
        record_use(rewrite_version_id, passed=False, json_retry=rewrite_json_retry)
        record_use(polish_version_id, passed=False, json_retry=polish_json_retry,
                   banned_word_retry=polish_banned_retry)
        progress.emit(
            article.title, kind="skipped", url=article.url,
            reason=f"Numeric verification failed ({len(missing)} unverified)",
        )
        return

    if not article.original_title:
        article.original_title = article.title  # legacy backfill — first overwrite preserves it
    article.title = final_headline
    article.summary = final_body
    article.impact_score = impact
    article.status = "pending_human"
    article.ai_processed = True
    article.ai_processed_at = datetime.utcnow()
    db.commit()

    # A/B telemetry for the three prompts used on this article (#12)
    record_use(qa_version_id, passed=True, json_retry=qa_json_retry)
    record_use(rewrite_version_id, passed=True, json_retry=rewrite_json_retry)
    record_use(polish_version_id, passed=True, json_retry=polish_json_retry,
               banned_word_retry=polish_banned_retry)

    elapsed_b = round((datetime.utcnow() - t_b).total_seconds(), 1)
    elapsed_total = round((datetime.utcnow() - t_a).total_seconds(), 1)
    preview = (article.summary or "")[:300].strip()
    progress.emit(
        article.title, kind="publish",
        url=article.url, topic=article.topic, decision=decision,
        confidence=int(confidence), image_url=article.image_url, preview=preview,
        elapsed_a=elapsed_a, elapsed_b=elapsed_b, elapsed_total=elapsed_total,
    )

    logger.info(
        "Article %s processed: topic=%s relevance=%.2f confidence=%.0f",
        article.id, article.topic, article.relevance_score, confidence,
    )
