"""
Admin / moderation routes — all require X-Admin-Token header.
"""
from datetime import datetime

import asyncio
import json
import os
import time

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Security
from fastapi.responses import StreamingResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.article import Article
from app.models.daily_digest import DailyDigest
from app.models.scrape_run import ScrapeRun
from app.models.source import Source
from app.schemas.article import ArticleAdminOut, ApproveRequest, RejectRequest
from app.schemas.digest import DigestOut
from app.schemas.source import SourceAdminOut, SourceUpdate

router = APIRouter(prefix="/admin", tags=["admin"])

_api_key_header = APIKeyHeader(name="X-Admin-Token", auto_error=False)

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "Burak"
SCHEDULE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "schedule.json")


def _check_token(token: str = Security(_api_key_header)):
    if token != settings.ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Invalid admin token")


# ── Authentication ────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def admin_login(body: LoginRequest):
    if body.username != ADMIN_USERNAME or body.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"token": settings.ADMIN_SECRET, "username": body.username}


# ── Source Management ─────────────────────────────────────────────────────────

@router.get("/sources", response_model=list[SourceAdminOut], dependencies=[Depends(_check_token)])
def list_sources(db: Session = Depends(get_db)):
    return db.query(Source).order_by(Source.name).all()


@router.patch("/sources/{source_id}", response_model=SourceAdminOut, dependencies=[Depends(_check_token)])
def update_source(source_id: int, body: SourceUpdate, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(source, field, value)
    db.commit()
    db.refresh(source)
    return source


# ── AI Models Status ──────────────────────────────────────────────────────────

@router.get("/models", dependencies=[Depends(_check_token)])
def get_models_status():
    from app.ai.client import _multiplex
    if _multiplex is None:
        return []
    now = time.monotonic()
    return [
        {
            "name": m.name,
            "status": "cooldown" if m.cooldown_until > now else "available",
            "cooldown_remaining_sec": max(0.0, round(m.cooldown_until - now, 1)),
        }
        for m in _multiplex.models
    ]


# ── Scheduler Config ──────────────────────────────────────────────────────────

def _read_schedule() -> dict:
    if os.path.exists(SCHEDULE_FILE):
        with open(SCHEDULE_FILE) as f:
            return json.load(f)
    return {
        "scrape_hour": settings.SCRAPE_SCHEDULE_HOUR,
        "scrape_minute": 0,
        "digest_hour": settings.DIGEST_SCHEDULE_HOUR,
        "digest_minute": 15,
        "enabled": True,
    }


def _write_schedule(config: dict) -> None:
    os.makedirs(os.path.dirname(SCHEDULE_FILE), exist_ok=True)
    with open(SCHEDULE_FILE, "w") as f:
        json.dump(config, f)


@router.get("/scheduler", dependencies=[Depends(_check_token)])
def get_scheduler():
    return _read_schedule()


@router.put("/scheduler", dependencies=[Depends(_check_token)])
def update_scheduler(config: dict = Body(...)):
    allowed = {"scrape_hour", "scrape_minute", "digest_hour", "digest_minute", "enabled"}
    filtered = {k: v for k, v in config.items() if k in allowed}
    current = _read_schedule()
    current.update(filtered)
    _write_schedule(current)

    # Reschedule running APScheduler jobs if scheduler is available
    try:
        from app.main import scheduler as _sched
        from apscheduler.triggers.cron import CronTrigger
        from app.scheduler.jobs import _run_scrape, _run_digest

        if _sched and _sched.running:
            _sched.reschedule_job(
                "daily_scrape",
                trigger=CronTrigger(hour=current["scrape_hour"], minute=current.get("scrape_minute", 0)),
            )
            _sched.reschedule_job(
                "daily_digest",
                trigger=CronTrigger(hour=current["digest_hour"], minute=current.get("digest_minute", 15)),
            )
    except Exception:
        pass  # scheduler not running or job not found — config saved, applies on restart

    return current


# ── Moderation Queue ──────────────────────────────────────────────────────────

@router.get("/queue", response_model=list[ArticleAdminOut], dependencies=[Depends(_check_token)])
def get_moderation_queue(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: str = Query("pending_human"),
    db: Session = Depends(get_db),
):
    order = Article.approved_at.desc() if status == "published" else (
        Article.approved_at.desc() if status == "rejected" else Article.quality_score.desc()
    )
    return (
        db.query(Article)
        .filter(Article.status == status)
        .order_by(order)
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )


@router.post("/articles/{article_id}/approve", dependencies=[Depends(_check_token)])
def approve_article(
    article_id: int,
    body: ApproveRequest,
    db: Session = Depends(get_db),
):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.status not in ("pending_human", "rejected", "rejected_ai"):
        raise HTTPException(status_code=400, detail=f"Cannot approve article with status '{article.status}'")

    article.status = "published"
    article.approved_by = body.approved_by
    article.approved_at = datetime.utcnow()
    article.rejection_reason = None
    db.commit()
    return {"id": article_id, "status": "published"}


@router.post("/articles/{article_id}/reject", dependencies=[Depends(_check_token)])
def reject_article(
    article_id: int,
    body: RejectRequest,
    db: Session = Depends(get_db),
):
    article = db.query(Article).filter(Article.id == article_id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    article.status = "rejected"
    article.rejection_reason = body.reason
    article.approved_by = body.rejected_by
    article.approved_at = datetime.utcnow()
    db.commit()
    return {"id": article_id, "status": "rejected"}


# ── Digest Moderation ─────────────────────────────────────────────────────────

@router.get("/digests/pending", response_model=list[DigestOut], dependencies=[Depends(_check_token)])
def get_pending_digests(db: Session = Depends(get_db)):
    return (
        db.query(DailyDigest)
        .filter(DailyDigest.status == "pending_review")
        .order_by(DailyDigest.digest_date.desc())
        .all()
    )


@router.post("/digests/{digest_id}/approve", dependencies=[Depends(_check_token)])
def approve_digest(
    digest_id: int,
    body: ApproveRequest,
    db: Session = Depends(get_db),
):
    digest = db.query(DailyDigest).filter(DailyDigest.id == digest_id).first()
    if not digest:
        raise HTTPException(status_code=404, detail="Digest not found")

    digest.status = "published"
    digest.approved_by = body.approved_by
    digest.approved_at = datetime.utcnow()
    db.commit()
    return {"id": digest_id, "status": "published"}


@router.post("/digests/{digest_id}/reject", dependencies=[Depends(_check_token)])
def reject_digest(
    digest_id: int,
    body: RejectRequest,
    db: Session = Depends(get_db),
):
    digest = db.query(DailyDigest).filter(DailyDigest.id == digest_id).first()
    if not digest:
        raise HTTPException(status_code=404, detail="Digest not found")

    digest.status = "rejected"
    db.commit()
    return {"id": digest_id, "status": "rejected"}


# ── Live Progress Stream ──────────────────────────────────────────────────────

@router.get("/scrape-events")
async def scrape_events(token: str = Query(...)):
    """SSE endpoint — streams scrape progress events. Token passed as query param."""
    if token != settings.ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Invalid token")

    from app.ai import progress

    async def generate():
        index = 0
        idle_ticks = 0
        while idle_ticks < 600:  # max 5 min (600 × 0.5s)
            events = progress.get_events(index)
            for event in events:
                yield f"data: {json.dumps(event)}\n\n"
                index += 1
                idle_ticks = 0
                if event.get("kind") == "done":
                    return
            idle_ticks += 1
            await asyncio.sleep(0.5)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Manual Triggers ───────────────────────────────────────────────────────────

@router.post("/trigger-scrape", dependencies=[Depends(_check_token)])
async def trigger_scrape(
    source_slug: str = "all",
):
    import asyncio
    import threading
    from app.pipeline.orchestrator import run_scrape_pipeline

    def _run_in_thread():
        # Own event loop per thread so time.sleep() in AI processing
        # never blocks the main FastAPI event loop (which serves SSE).
        asyncio.run(run_scrape_pipeline(source_slug))

    threading.Thread(target=_run_in_thread, daemon=True).start()
    return {"message": f"Scrape triggered for '{source_slug}'"}


@router.post("/trigger-digest", dependencies=[Depends(_check_token)])
def trigger_digest(db: Session = Depends(get_db)):
    from datetime import date
    from app.ai.digest_generator import generate_digest

    digest = generate_digest(date.today(), db)
    if not digest:
        raise HTTPException(status_code=500, detail="Digest generation failed — no published articles?")
    return {"id": digest.id, "status": digest.status, "headline": digest.headline}


@router.delete("/articles/all", dependencies=[Depends(_check_token)])
def delete_all_articles(db: Session = Depends(get_db)):
    count = db.query(Article).count()
    db.query(Article).delete()
    db.commit()
    return {"deleted": count}


# ── Audit Log ─────────────────────────────────────────────────────────────────

@router.get("/scrape-runs", dependencies=[Depends(_check_token)])
def get_scrape_runs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    runs = (
        db.query(ScrapeRun)
        .order_by(ScrapeRun.started_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return [
        {
            "id": r.id,
            "source_id": r.source_id,
            "source_name": r.source.name if r.source else None,
            "started_at": r.started_at,
            "completed_at": r.completed_at,
            "status": r.status,
            "articles_found": r.articles_found,
            "articles_new": r.articles_new,
            "error_message": r.error_message,
        }
        for r in runs
    ]
