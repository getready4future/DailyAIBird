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


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables if they don't exist yet (idempotent, Alembic handles migrations)
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ready")

    # Start scheduler
    from app.scheduler.jobs import create_scheduler
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
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


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "service": "Daily AI Bird"}
