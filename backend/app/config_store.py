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
