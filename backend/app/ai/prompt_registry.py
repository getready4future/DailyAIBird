"""Prompt-version lookup helpers for A/B testing (#12).

The processor calls `pick_prompt(key, article_id, default_text)` to get the
prompt text it should use, plus a version_id (or None for hard-coded default).
It then calls `record_use(version_id, ...)` after each LLM call to update
aggregate telemetry on the PromptVersion row.

Selection rules:
  - If a version is is_experiment for `key`, split 50/50 with the is_active
    one based on article_id parity.
  - Else if a version is is_active for `key`, use that.
  - Else use the default text passed by the caller (current behaviour).
"""
from __future__ import annotations
import logging

logger = logging.getLogger(__name__)


def pick_prompt(key: str, article_id: int, default_text: str) -> tuple[str, int | None]:
    """Return (prompt_text, version_id_or_None).

    Resolution order:
      1. PromptVersion experiment + active → 50/50 by article-id parity
      2. PromptVersion active → that text
      3. Legacy `config_store.get_prompt(legacy_key)` admin override
      4. Hard-coded default supplied by caller
    """
    try:
        from app.database import SessionLocal
        from app.models.prompt_version import PromptVersion
        db = SessionLocal()
        try:
            active = (
                db.query(PromptVersion)
                .filter(PromptVersion.key == key, PromptVersion.is_active.is_(True))
                .first()
            )
            experiment = (
                db.query(PromptVersion)
                .filter(PromptVersion.key == key, PromptVersion.is_experiment.is_(True))
                .first()
            )
            if experiment and active and experiment.id != active.id:
                chosen = experiment if (article_id % 2 == 1) else active
                return chosen.text, chosen.id
            if active:
                return active.text, active.id
        finally:
            db.close()
    except Exception as exc:
        logger.debug("pick_prompt DB lookup failed: %s", exc)

    # Legacy admin override path (config_store)
    try:
        from app.config_store import get_prompt as _legacy
        # quality_check stays mapped 1:1; rewrite/polish were not legacy keys —
        # they fall back to the new "enrich" override only when the legacy
        # single-call path is forced (handled in processor.py separately).
        legacy_key = "quality_check" if key == "quality_check" else None
        if legacy_key:
            txt = _legacy(legacy_key)
            if txt:
                return txt, None
    except Exception:
        pass

    return default_text, None


def record_use(
    version_id: int | None, *,
    passed: bool = False,
    json_retry: bool = False,
    banned_word_retry: bool = False,
    input_tokens: int = 0,
    output_tokens: int = 0,
) -> None:
    """Increment per-version telemetry counters. Best-effort; never raises."""
    if version_id is None:
        return
    try:
        from app.database import SessionLocal
        from app.models.prompt_version import PromptVersion
        db = SessionLocal()
        try:
            row = db.query(PromptVersion).filter(PromptVersion.id == version_id).first()
            if row is None:
                return
            row.use_count += 1
            if passed:
                row.pass_count += 1
            if json_retry:
                row.json_retry_count += 1
            if banned_word_retry:
                row.banned_word_retry_count += 1
            row.total_input_tokens += int(input_tokens or 0)
            row.total_output_tokens += int(output_tokens or 0)
            db.commit()
        finally:
            db.close()
    except Exception as exc:
        logger.debug("record_use failed for version %s: %s", version_id, exc)
