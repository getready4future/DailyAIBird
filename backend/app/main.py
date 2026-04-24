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
    """Create the default admin user if no users exist."""
    import secrets
    from app.database import SessionLocal
    from app.models.admin_user import AdminUser
    from app.auth import hash_password
    from datetime import datetime

    db = SessionLocal()
    try:
        if db.query(AdminUser).count() == 0:
            password = settings.ADMIN_PASSWORD
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
    finally:
        db.close()


DEFAULT_SOURCE_SLUGS = [
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
    """Populate sources table with defaults from catalog if empty."""
    from app.database import SessionLocal
    from app.models.source import Source
    from app.scrapers.source_catalog import CATALOG
    from datetime import datetime

    db = SessionLocal()
    try:
        if db.query(Source).count() > 0:
            return
        catalog_map = {s["slug"]: s for s in CATALOG}
        added = 0
        for slug in DEFAULT_SOURCE_SLUGS:
            entry = catalog_map.get(slug)
            if not entry:
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
            added += 1
        db.commit()
        logger.info("Seeded %d default sources", added)
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables if they don't exist yet (idempotent, Alembic handles migrations)
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ready")

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
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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


@app.get("/")
def root():
    return {"service": "Daily AI Bird API", "docs": "/docs", "health": "/api/v1/health"}


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "service": "Daily AI Bird"}
