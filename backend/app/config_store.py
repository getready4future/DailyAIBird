"""
Runtime-mutable application config, persisted in the app_settings DB table.
Falls back to settings values when a key is not yet stored.
"""
import json

from app.config import settings


def _get_db():
    from app.database import SessionLocal
    return SessionLocal()


def get_setting(key: str, default=None):
    from app.models.app_setting import AppSetting
    db = _get_db()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        if row is None:
            return default
        return json.loads(row.value)
    except Exception:
        return default
    finally:
        db.close()


def set_setting(key: str, value) -> None:
    from app.models.app_setting import AppSetting
    from datetime import datetime
    db = _get_db()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        encoded = json.dumps(value)
        if row:
            row.value = encoded
            row.updated_at = datetime.utcnow()
        else:
            db.add(AppSetting(key=key, value=encoded))
        db.commit()
    finally:
        db.close()


def get_all() -> dict:
    from app.models.app_setting import AppSetting
    db = _get_db()
    try:
        rows = db.query(AppSetting).all()
        return {r.key: json.loads(r.value) for r in rows}
    except Exception:
        return {}
    finally:
        db.close()


# ── Convenience helpers ────────────────────────────────────────────────────────

def get_max_articles_per_source() -> int:
    return int(get_setting("max_articles_per_source", settings.MAX_ARTICLES_PER_SOURCE))


DEFAULT_SCHEDULE = {
    "scrape_hour":   settings.SCRAPE_SCHEDULE_HOUR,
    "scrape_minute": 0,
    "digest_hour":   settings.DIGEST_SCHEDULE_HOUR,
    "digest_minute": 15,
    "enabled":       True,
}


def get_schedule() -> dict:
    stored = get_setting("schedule", None)
    if stored and isinstance(stored, dict):
        return {**DEFAULT_SCHEDULE, **stored}
    return dict(DEFAULT_SCHEDULE)


def save_schedule(config: dict) -> None:
    current = get_schedule()
    current.update(config)
    set_setting("schedule", current)


# ── Pipeline config ────────────────────────────────────────────────────────────

DEFAULT_PIPELINE_CONFIG = {
    "cutoff_hours": 48,
    "dedup_threshold": 0.65,
    "confidence_reject_threshold": 3,
    "feature_min_score": 0.75,
    "top_featured": 5,
    "scrape_concurrency": 5,
    "ai_batch_size": 5,
}


def get_pipeline_config() -> dict:
    stored = get_setting("pipeline_config", None)
    if stored and isinstance(stored, dict):
        return {**DEFAULT_PIPELINE_CONFIG, **stored}
    return dict(DEFAULT_PIPELINE_CONFIG)


def save_pipeline_config(config: dict) -> None:
    current = get_pipeline_config()
    current.update(config)
    set_setting("pipeline_config", current)


# ── AI Prompts ─────────────────────────────────────────────────────────────────

def get_prompt(key: str) -> str | None:
    """Return custom prompt override, or None to use the default from prompts.py."""
    return get_setting(f"prompt_{key}", None)


def save_prompt(key: str, text: str) -> None:
    set_setting(f"prompt_{key}", text)


def reset_prompt(key: str) -> None:
    from app.models.app_setting import AppSetting
    db = _get_db()
    try:
        row = db.query(AppSetting).filter(AppSetting.key == f"prompt_{key}").first()
        if row:
            db.delete(row)
            db.commit()
    finally:
        db.close()


# ── SEO config ────────────────────────────────────────────────────────────────

DEFAULT_SEO_CONFIG = {
    "site_name":          "Daily AI Bird",
    "site_url":           "https://dailyaibird.com",
    "site_title":         "Daily AI Bird — AI News for Developers",
    "site_description":   "AI-curated daily news for AI developers and researchers. Fresh updates every morning.",
    "default_og_image":   "/bird-og.png",
    "twitter_handle":     "@dailyaibird",
    "publisher_name":     "Daily AI Bird",
    "language":           "en",
    "robots_extra":       "",
}


def get_seo_config() -> dict:
    stored = get_setting("seo_config", None)
    if stored and isinstance(stored, dict):
        return {**DEFAULT_SEO_CONFIG, **stored}
    return dict(DEFAULT_SEO_CONFIG)


def save_seo_config(config: dict) -> None:
    current = get_seo_config()
    current.update(config)
    set_setting("seo_config", current)
