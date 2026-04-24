"""
Runtime-mutable application config, persisted to data/app_config.json.
Falls back to settings values on missing keys.
"""
import json
import os

from app.config import settings

_CONFIG_FILE = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "data", "app_config.json"
)


def load() -> dict:
    if os.path.exists(_CONFIG_FILE):
        try:
            with open(_CONFIG_FILE) as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save(config: dict) -> None:
    os.makedirs(os.path.dirname(_CONFIG_FILE), exist_ok=True)
    with open(_CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)


def get_max_articles_per_source() -> int:
    return int(load().get("max_articles_per_source", settings.MAX_ARTICLES_PER_SOURCE))
