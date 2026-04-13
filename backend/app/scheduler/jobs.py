import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import settings
from app.database import SessionLocal

logger = logging.getLogger(__name__)


def _run_scrape():
    from app.pipeline.orchestrator import run_scrape_pipeline
    asyncio.get_event_loop().run_until_complete(run_scrape_pipeline("all"))


def _run_digest():
    from app.pipeline.orchestrator import run_digest_pipeline
    run_digest_pipeline()


def _run_cleanup():
    """Delete articles older than 30 days (keep digests)."""
    from datetime import datetime, timedelta
    from app.models.article import Article

    db = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=30)
        deleted = db.query(Article).filter(Article.created_at < cutoff).delete()
        db.commit()
        logger.info("Cleanup: deleted %d old articles", deleted)
    finally:
        db.close()


def create_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="UTC")

    scheduler.add_job(
        _run_scrape,
        CronTrigger(hour=settings.SCRAPE_SCHEDULE_HOUR, minute=0),
        id="daily_scrape",
        max_instances=1,
        misfire_grace_time=3600,
    )

    scheduler.add_job(
        _run_digest,
        CronTrigger(hour=settings.DIGEST_SCHEDULE_HOUR, minute=15),
        id="daily_digest",
        max_instances=1,
    )

    scheduler.add_job(
        _run_cleanup,
        CronTrigger(hour=3, minute=0),
        id="daily_cleanup",
    )

    return scheduler
