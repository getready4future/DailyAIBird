import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import engine
from app.models import Source, Article, DailyDigest, DigestArticle, ScrapeRun  # noqa: F401 — register models
from app.database import Base

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL, logging.INFO))
logger = logging.getLogger(__name__)

scheduler = None  # set during lifespan, referenced by admin router


def _seed_admin_user() -> None:
    """Create or update the default admin user."""
    import secrets
    from app.database import SessionLocal
    from app.models.admin_user import AdminUser
    from app.auth import hash_password
    from datetime import datetime

    db = SessionLocal()
    try:
        existing = db.query(AdminUser).filter(AdminUser.username == "admin").first()
        password = settings.ADMIN_PASSWORD

        if existing is None:
            if not password:
                password = secrets.token_urlsafe(16)
                logger.warning("=" * 60)
                logger.warning("ADMIN_PASSWORD not set in .env — generated a random password.")
                logger.warning("Username: admin  Password: %s", password)
                logger.warning("Add ADMIN_PASSWORD=%s to your .env to keep this password.", password)
                logger.warning("=" * 60)
            admin = AdminUser(
                username="admin",
                password_hash=hash_password(password),
                display_name="Admin",
                role="admin",
                is_active=True,
                created_at=datetime.utcnow(),
            )
            db.add(admin)
            db.commit()
            logger.info("Default admin user created (username: admin)")
        elif password:
            existing.password_hash = hash_password(password)
            db.commit()
            logger.info("Admin password updated from ADMIN_PASSWORD env var")
    finally:
        db.close()


DEFAULT_SOURCE_SLUGS = [
    # Aggregator
    "google-news-ai",
    # AI Lab blogs
    "openai-news", "anthropic-news", "deepmind-blog", "google-ai-blog",
    "meta-ai-blog", "microsoft-ai-blog", "huggingface-blog",
    # Tech news
    "techcrunch-ai", "verge-ai", "venturebeat-ai", "wired-ai",
    "mit-tech-review-ai", "ars-technica-ai",
    # Community
    "hackernews-ai", "reddit-ml", "reddit-artificial",
    # Research
    "arxiv-cs-ai", "arxiv-cs-lg",
    # Policy & Safety
    "fli-news", "ai-safety-newsletter", "stanford-hai",
]


def _seed_sources() -> None:
    """Ensure every DEFAULT_SOURCE_SLUGS entry exists in the DB (idempotent)."""
    from app.database import SessionLocal
    from app.models.source import Source
    from app.scrapers.source_catalog import CATALOG
    from datetime import datetime

    db = SessionLocal()
    try:
        catalog_map = {s["slug"]: s for s in CATALOG}
        existing_slugs = {row[0] for row in db.query(Source.slug).all()}
        added = 0
        for slug in DEFAULT_SOURCE_SLUGS:
            if slug in existing_slugs:
                continue
            entry = catalog_map.get(slug)
            if not entry:
                logger.warning("Default source slug '%s' not found in catalog — skipping", slug)
                continue
            db.add(Source(
                name=entry["name"],
                slug=entry["slug"],
                url=entry["url"],
                feed_url=entry.get("feed_url"),
                scraper_type=entry["scraper_type"],
                category=entry["category"],
                is_active=True,
                created_at=datetime.utcnow(),
            ))
            existing_slugs.add(slug)
            added += 1
        if added:
            db.commit()
            logger.info("Seeded %d missing default sources", added)
        else:
            logger.info("All default sources already present (%d total)", len(existing_slugs))
    except Exception as exc:
        logger.error("Source seeding failed: %s", exc)
        db.rollback()
    finally:
        db.close()


def _ensure_columns() -> None:
    """Add columns that may be missing due to failed Alembic migrations."""
    from sqlalchemy import text
    stmts = [
        "ALTER TABLE articles ADD COLUMN IF NOT EXISTS curiosity_score FLOAT",
        "ALTER TABLE articles ADD COLUMN IF NOT EXISTS momentum_score INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS feed_url VARCHAR",
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS max_articles INTEGER",
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS context_prompt TEXT",
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS cron_schedule VARCHAR",
        "ALTER TABLE sources ADD COLUMN IF NOT EXISTS scrape_config TEXT DEFAULT '{}'",
    ]
    with engine.begin() as conn:
        for stmt in stmts:
            try:
                conn.execute(text(stmt))
            except Exception as exc:
                logger.warning("Column ensure skipped (%s): %s", stmt[:60], exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run Alembic migrations then create any remaining tables
    try:
        from alembic.config import Config as AlembicConfig
        from alembic import command as alembic_command
        import os
        alembic_cfg = AlembicConfig(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
        alembic_cfg.set_main_option("script_location", os.path.join(os.path.dirname(__file__), "..", "alembic"))
        alembic_cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
        alembic_command.upgrade(alembic_cfg, "head")
        logger.info("Alembic migrations applied")
    except Exception as exc:
        logger.warning("Alembic migration failed (non-fatal): %s", exc)
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ready")

    # Ensure columns added after initial schema exist (safe on repeated restarts)
    _ensure_columns()

    _seed_admin_user()
    _seed_sources()

    # Start scheduler
    from app.scheduler.jobs import create_scheduler
    global scheduler
    scheduler = create_scheduler()
    scheduler.start()
    logger.info("Scheduler started")

    yield

    scheduler.shutdown()
    logger.info("Scheduler stopped")


app = FastAPI(
    title="Daily AI Bird API",
    version="1.0.0",
    description="AI-curated daily news for the AI developer community",
    lifespan=lifespan,
)

_cors_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
_allow_all = "*" in _cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _allow_all else _cors_origins,
    allow_credentials=False if _allow_all else True,
    allow_methods=["*"],
    allow_headers=["Content-Type", "Authorization", "X-Admin-Token", "X-Requested-With"],
    expose_headers=["*"],
)

# Public routes
from app.routers import articles, digests, sources, topics  # noqa: E402
app.include_router(articles.router, prefix="/api/v1")
app.include_router(digests.router, prefix="/api/v1")
app.include_router(sources.router, prefix="/api/v1")
app.include_router(topics.router, prefix="/api/v1")

# Admin routes
from app.routers import admin  # noqa: E402
app.include_router(admin.router, prefix="/api/v1")

# SEO routes (sitemap, robots) — mounted at root, NOT under /api/v1
from app.routers import seo as seo_router  # noqa: E402
app.include_router(seo_router.router)


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "service": "Daily AI Bird"}


# Serve frontend static files if built into the image
import os as _os
from pathlib import Path as _Path

_static_dir = _Path(__file__).parent.parent / "static"
if _static_dir.exists():
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse

    app.mount("/assets", StaticFiles(directory=str(_static_dir / "assets")), name="assets")

    from fastapi import Request as _Req
    from fastapi.responses import HTMLResponse as _HTML
    from app.routers.seo import is_bot, render_for_bot, AGENT_LINK_HEADER

    _index_path = _static_dir / "index.html"
    # RFC 8288 headers attached to every SPA shell response for agent discovery
    _spa_headers = {"Link": AGENT_LINK_HEADER}

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str, request: _Req):
        # Static files (assets, images, etc.) served directly — no Link header needed
        file = _static_dir / full_path
        if file.exists() and file.is_file():
            return FileResponse(str(file))

        # Bot detection: render meta-tag-rich HTML for crawlers/scrapers
        ua = request.headers.get("user-agent", "")
        if is_bot(ua):
            try:
                shell = _index_path.read_text(encoding="utf-8")
                base_url = str(request.base_url).rstrip("/")
                rendered = render_for_bot(f"/{full_path}", base_url, shell)
                if rendered:
                    return _HTML(rendered, headers=_spa_headers)
            except Exception as exc:
                logger.warning("Bot rendering failed (%s): %s", full_path, exc)

        # SPA shell — include RFC 8288 Link headers for agent discovery
        return FileResponse(str(_index_path), headers=_spa_headers)
else:
    from app.routers.seo import AGENT_LINK_HEADER as _LINK_HDR

    @app.get("/")
    def root():
        from fastapi.responses import JSONResponse as _JSON
        return _JSON(
            {"service": "Daily AI Bird API", "docs": "/docs", "health": "/api/v1/health"},
            headers={"Link": _LINK_HDR},
        )
