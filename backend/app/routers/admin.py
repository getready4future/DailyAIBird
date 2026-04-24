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
from app.models.admin_user import AdminUser
from app.models.daily_digest import DailyDigest
from app.models.scrape_run import ScrapeRun
from app.models.source import Source
from app.schemas.article import ArticleAdminOut, ApproveRequest, RejectRequest
from app.schemas.digest import DigestOut
from app.schemas.source import SourceAdminOut, SourceUpdate
from app.auth import hash_password, verify_password

router = APIRouter(prefix="/admin", tags=["admin"])

_api_key_header = APIKeyHeader(name="X-Admin-Token", auto_error=False)

SCHEDULE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "schedule.json")


def _check_token(token: str = Security(_api_key_header)):
    if token != settings.ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Invalid admin token")


# ── Authentication ────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def admin_login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(AdminUser).filter(
        AdminUser.username == body.username,
        AdminUser.is_active.is_(True),
    ).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    user.last_login_at = datetime.utcnow()
    db.commit()
    return {"token": settings.ADMIN_SECRET, "username": user.username, "role": user.role, "display_name": user.display_name}


# ── User Management ───────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    password: str
    display_name: str = ""
    role: str = "editor"


class UserUpdate(BaseModel):
    display_name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None


@router.get("/users", dependencies=[Depends(_check_token)])
def list_users(db: Session = Depends(get_db)):
    users = db.query(AdminUser).order_by(AdminUser.created_at).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "display_name": u.display_name,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at,
            "last_login_at": u.last_login_at,
        }
        for u in users
    ]


@router.post("/users", dependencies=[Depends(_check_token)])
def create_user(body: UserCreate, db: Session = Depends(get_db)):
    if db.query(AdminUser).filter(AdminUser.username == body.username).first():
        raise HTTPException(status_code=409, detail="Username already exists")
    user = AdminUser(
        username=body.username,
        password_hash=hash_password(body.password),
        display_name=body.display_name or body.username,
        role=body.role,
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"id": user.id, "username": user.username, "role": user.role}


@router.patch("/users/{user_id}", dependencies=[Depends(_check_token)])
def update_user(user_id: int, body: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.display_name is not None:
        user.display_name = body.display_name
    if body.role is not None:
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.password:
        user.password_hash = hash_password(body.password)
    db.commit()
    return {"id": user.id, "username": user.username, "role": user.role, "is_active": user.is_active}


@router.delete("/users/{user_id}", dependencies=[Depends(_check_token)])
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(AdminUser).filter(AdminUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Prevent deleting the last admin
    admin_count = db.query(AdminUser).filter(AdminUser.role == "admin", AdminUser.is_active.is_(True)).count()
    if user.role == "admin" and admin_count <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last admin user")
    db.delete(user)
    db.commit()
    return {"deleted": user_id}


# ── Source Management ─────────────────────────────────────────────────────────

@router.get("/sources", response_model=list[SourceAdminOut], dependencies=[Depends(_check_token)])
def list_sources(db: Session = Depends(get_db)):
    return db.query(Source).order_by(Source.name).all()


@router.post("/sources/{source_id}/test", dependencies=[Depends(_check_token)])
async def test_source(source_id: int, db: Session = Depends(get_db)):
    """Dry-run the scraper for a source and return up to 3 sample articles (not saved)."""
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    from app.scrapers import get_scraper
    cfg = {
        "slug": source.slug,
        "url": source.url,
        "feed_url": source.feed_url,
        "scraper_type": source.scraper_type,
        "scrape_config": json.loads(source.scrape_config or "{}"),
    }
    scraper = get_scraper(cfg)
    try:
        articles = await scraper.fetch_articles()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Scraper error: {exc}")

    return [
        {
            "title": a.title,
            "url": a.url,
            "author": a.author,
            "published_at": a.published_at,
            "image_url": a.image_url,
            "summary": (a.raw_content or "")[:300].strip(),
            "tags": a.tags,
        }
        for a in articles[:2]
    ]


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
    from app.ai.client import _multiplex, _openrouter_ok
    result = []

    # OpenRouter (primary)
    if settings.OPENROUTER_API_KEY:
        result.append({
            "name": f"[OpenRouter] {settings.OPENROUTER_MODEL}",
            "status": "available" if _openrouter_ok else "cooldown",
            "cooldown_remaining_sec": 0.0,
            "role": "primary",
        })

    # NVIDIA multiplex chain (secondary)
    if _multiplex is not None:
        now = time.monotonic()
        for m in _multiplex.models:
            remaining = max(0.0, round(m.cooldown_until - now, 1))
            result.append({
                "name": f"[NVIDIA] {m.name}",
                "status": "cooldown" if m.cooldown_until > now else "available",
                "cooldown_remaining_sec": remaining,
                "role": "fallback",
            })

    return result


# ── AI Provider Selection ─────────────────────────────────────────────────────

@router.get("/ai-provider", dependencies=[Depends(_check_token)])
def get_ai_provider():
    from app.ai.client import get_active_provider
    return {
        "active": get_active_provider(),
        "openrouter_available": bool(settings.OPENROUTER_API_KEY),
        "openrouter_model": settings.OPENROUTER_MODEL,
        "nvidia_available": bool(settings.NVIDIA_API_KEY),
        "generic_available": bool(settings.AI_API_KEY),
    }


@router.post("/ai-provider", dependencies=[Depends(_check_token)])
def set_ai_provider(body: dict):
    provider = body.get("provider", "")
    if provider not in ("openrouter", "nvidia", "generic"):
        raise HTTPException(status_code=400, detail="provider must be 'openrouter', 'nvidia', or 'generic'")
    from app.ai.client import set_active_provider
    set_active_provider(provider)
    return {"active": provider}


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


# ── Source Discovery ─────────────────────────────────────────────────────────

@router.get("/sources/catalog", dependencies=[Depends(_check_token)])
def get_source_catalog(db: Session = Depends(get_db)):
    """Return curated catalog entries that are not yet in the DB."""
    from app.scrapers.source_catalog import CATALOG
    existing_slugs = {s.slug for s in db.query(Source.slug).all()}
    return [
        {**entry, "already_added": entry["slug"] in existing_slugs}
        for entry in CATALOG
    ]


class ImportSourceBody(BaseModel):
    name: str
    slug: str
    url: str
    feed_url: str | None = None
    scraper_type: str
    category: str
    scrape_config: dict = {}


@router.post("/sources/import", dependencies=[Depends(_check_token)])
def import_catalog_source(body: ImportSourceBody, db: Session = Depends(get_db)):
    """Add a catalog source to the database."""
    if db.query(Source).filter(Source.slug == body.slug).first():
        raise HTTPException(status_code=409, detail="Source already exists")
    source = Source(
        name=body.name,
        slug=body.slug,
        url=body.url,
        feed_url=body.feed_url,
        scraper_type=body.scraper_type,
        category=body.category,
        scrape_config=json.dumps(body.scrape_config),
        is_active=True,
        created_at=datetime.utcnow(),
    )
    db.add(source)
    db.commit()
    db.refresh(source)
    return {"id": source.id, "slug": source.slug, "name": source.name}


class AnalyzeUrlBody(BaseModel):
    url: str


@router.post("/sources/analyze", dependencies=[Depends(_check_token)])
async def analyze_source_url(body: AnalyzeUrlBody):
    """
    Fetch a URL, detect RSS feeds, then use AI to assess if it's a good AI news source.
    Returns a structured assessment with suggested import config.
    """
    import httpx
    import re
    from bs4 import BeautifulSoup

    url = body.url.strip()
    if not url.startswith("http"):
        url = "https://" + url

    # ── Fetch the page ────────────────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True,
                                     headers={"User-Agent": "DailyAIBird/1.0 (source analyzer)"}) as client:
            resp = await client.get(url)
        html = resp.text
        final_url = str(resp.url)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Could not fetch URL: {exc}")

    soup = BeautifulSoup(html, "html.parser")

    # ── Detect site name ──────────────────────────────────────────────────────
    site_name = ""
    og_site = soup.find("meta", property="og:site_name")
    if og_site:
        site_name = og_site.get("content", "")
    if not site_name:
        title_tag = soup.find("title")
        if title_tag:
            site_name = title_tag.get_text(strip=True).split("|")[0].split("-")[0].strip()

    # ── Detect RSS/Atom feeds ─────────────────────────────────────────────────
    feed_url = None
    feed_links = soup.find_all("link", rel="alternate", type=lambda t: t and ("rss" in t or "atom" in t))
    if feed_links:
        href = feed_links[0].get("href", "")
        if href.startswith("/"):
            from urllib.parse import urljoin
            href = urljoin(final_url, href)
        feed_url = href

    # Try common feed path patterns if no autodiscovery
    if not feed_url:
        from urllib.parse import urlparse
        base = urlparse(final_url)
        base_url = f"{base.scheme}://{base.netloc}"
        async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
            for path in ["/feed", "/rss", "/feed.xml", "/rss.xml", "/atom.xml", "/blog/feed"]:
                try:
                    r = await client.get(base_url + path)
                    ct = r.headers.get("content-type", "")
                    if r.status_code == 200 and ("xml" in ct or "rss" in ct or "atom" in ct):
                        feed_url = base_url + path
                        break
                except Exception:
                    continue

    # ── Page excerpt for AI ───────────────────────────────────────────────────
    # Strip scripts/styles and take first 2000 chars
    for tag in soup(["script", "style", "nav", "footer"]):
        tag.decompose()
    text_excerpt = " ".join(soup.get_text(" ", strip=True).split())[:2000]

    # ── AI Assessment ─────────────────────────────────────────────────────────
    from app.ai.client import call_claude
    prompt = f"""You are evaluating a website to determine if it's a good source for an AI news aggregator targeting general readers.

Website URL: {final_url}
Detected name: {site_name}
Feed URL found: {feed_url or 'none'}
Page excerpt: {text_excerpt}

Assess this site and return ONLY valid JSON (no markdown):
{{
  "site_name": "<clean site name, max 40 chars>",
  "slug": "<url-friendly slug using hyphens, max 30 chars>",
  "description": "<one sentence describing what this site covers, max 100 chars>",
  "is_ai_relevant": <true|false — does this site regularly publish AI news?>,
  "quality_score": <1-5 — 1=low quality/irrelevant, 5=excellent primary AI source>,
  "category": "<one of: blog|news|newsletter|research|policy|social>",
  "primary_topics": ["<up to 3 main topics>"],
  "audience": "<technical|general|mixed>",
  "update_frequency": "<daily|weekly|irregular>",
  "recommendation": "<add|maybe|skip>",
  "reason": "<one sentence explaining the recommendation>"
}}"""

    try:
        raw = call_claude(prompt, max_tokens=400)
        # strip markdown
        raw = raw.strip()
        if raw.startswith("```"):
            raw = "\n".join(raw.splitlines()[1:-1])
        assessment = json.loads(raw)
    except Exception as exc:
        assessment = {
            "site_name": site_name or url,
            "slug": re.sub(r"[^a-z0-9-]", "-", (site_name or "source").lower())[:30],
            "description": "Could not analyze — add manually.",
            "is_ai_relevant": None,
            "quality_score": None,
            "category": "news",
            "primary_topics": [],
            "audience": "mixed",
            "update_frequency": "irregular",
            "recommendation": "maybe",
            "reason": f"AI analysis failed: {exc}",
        }

    return {
        **assessment,
        "url": final_url,
        "feed_url": feed_url,
        "scraper_type": "rss" if feed_url else "playwright",
    }


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
