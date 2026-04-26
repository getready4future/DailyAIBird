"""Source health scoring and run-to-run anomaly detection (#2, #3)."""
from __future__ import annotations
import logging
import statistics
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models.article import Article
from app.models.pipeline_run import PipelineRun
from app.models.scrape_run import ScrapeRun
from app.models.source import Source

logger = logging.getLogger(__name__)

CONSECUTIVE_FAILURE_DISABLE = 5


def recompute_source_health(db: Session) -> int:
    """Refresh health_score / consecutive_failures / publish_rate_30d.

    Auto-disables sources with too many consecutive failures.
    Returns the number of sources auto-disabled by this call.
    """
    cutoff_30d = datetime.utcnow() - timedelta(days=30)
    sources = db.query(Source).all()
    auto_disabled = 0

    for src in sources:
        runs = (
            db.query(ScrapeRun)
            .filter(ScrapeRun.source_id == src.id, ScrapeRun.started_at >= cutoff_30d)
            .order_by(ScrapeRun.started_at.desc())
            .all()
        )
        total_runs = len(runs)
        success_runs = sum(1 for r in runs if r.status == "success")
        success_rate = (success_runs / total_runs) if total_runs else 1.0

        # Consecutive failures = trailing run failures
        consecutive = 0
        for r in runs:
            if r.status != "success":
                consecutive += 1
            else:
                break

        # Publish rate (last 30d): published / found
        found_total = sum(r.articles_found or 0 for r in runs)
        published = (
            db.query(Article)
            .filter(
                Article.source_id == src.id,
                Article.created_at >= cutoff_30d,
                Article.status == "published",
            )
            .count()
        )
        publish_rate = (published / found_total) if found_total else 0.0

        src.consecutive_failures = consecutive
        src.publish_rate_30d = round(publish_rate, 3)
        src.health_score = round(success_rate * 0.5 + min(publish_rate * 5, 1.0) * 0.5, 3)

        # Auto-disable on too many consecutive failures
        if consecutive >= CONSECUTIVE_FAILURE_DISABLE and src.is_active:
            src.is_active = False
            src.auto_disabled_at = datetime.utcnow()
            auto_disabled += 1
            logger.warning(
                "Auto-disabled source '%s' after %d consecutive failures",
                src.slug, consecutive,
            )
            try:
                from app.ai import progress
                progress.emit(
                    f"Auto-disabled source '{src.slug}' (5 consecutive failures)",
                    kind="source_disabled", source=src.slug,
                )
            except Exception:
                pass

    db.commit()
    return auto_disabled


def detect_run_anomaly(db: Session, current_run: PipelineRun) -> str | None:
    """Compare current run's published count against the trailing 7-run baseline.

    Returns a human-readable anomaly reason if the current run is more than 2
    standard deviations below the mean, otherwise None.
    """
    baseline = (
        db.query(PipelineRun)
        .filter(
            PipelineRun.id != current_run.id,
            PipelineRun.status == "success",
            PipelineRun.source_slug == current_run.source_slug,
        )
        .order_by(PipelineRun.started_at.desc())
        .limit(7)
        .all()
    )
    if len(baseline) < 3:
        return None  # not enough history to flag

    counts = [r.total_ai_processed or 0 for r in baseline]
    if not any(counts):
        return None
    mean = statistics.mean(counts)
    try:
        stdev = statistics.stdev(counts) if len(counts) > 1 else 0.0
    except statistics.StatisticsError:
        stdev = 0.0
    current = current_run.total_ai_processed or 0

    # Flag if 2σ below mean OR <30% of mean (covers the σ=0 case)
    threshold_sigma = mean - 2 * stdev
    threshold_pct = mean * 0.3
    if current < threshold_sigma or current < threshold_pct:
        return (
            f"Anomaly: processed {current} articles vs 7-run mean {mean:.1f} "
            f"(σ={stdev:.1f}, source={current_run.source_slug})"
        )
    return None
