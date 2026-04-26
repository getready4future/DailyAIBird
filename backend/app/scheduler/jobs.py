import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.config import settings
from app.database import SessionLocal

logger = logging.getLogger(__name__)


async def _run_scrape():
    from app.pipeline.orchestrator import run_scrape_pipeline
    await run_scrape_pipeline("all")


async def _run_digest():
    import asyncio
    from app.pipeline.orchestrator import run_digest_pipeline
    await asyncio.to_thread(run_digest_pipeline)


def _run_cleanup():
    """Delete articles older than 30 days (keep digests)."""
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

    # Run scrape every 6 hours so articles stay fresh throughout the day.
    # Hours 0, 6, 12, 18 UTC — replacing the old single daily scrape.
    scheduler.add_job(
        _run_scrape,
        CronTrigger(hour="0,6,12,18", minute=0),
        id="scrape_6h",
        max_instances=1,
        misfire_grace_time=3600,
        coalesce=True,
    )

    # Digest runs after the morning scrape has had time to process
    scheduler.add_job(
        _run_digest,
        CronTrigger(hour=settings.DIGEST_SCHEDULE_HOUR, minute=15),
        id="daily_digest",
        max_instances=1,
        coalesce=True,
    )

    scheduler.add_job(
        _run_cleanup,
        CronTrigger(hour=3, minute=0),
        id="daily_cleanup",
    )

    return scheduler
