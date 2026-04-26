"""
Admin / moderation routes — all require X-Admin-Token header.
"""
from datetime import datetime

import asyncio
import json
import os
import time

import threading

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, Security
from fastapi.responses import StreamingResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import get_db
from app.models.article import Article
from app.models.admin_user import AdminUser
from app.models.daily_digest import DailyDigest
from app.models.scrape_run import ScrapeRun
from app.models.pipeline_run import PipelineRun
from app.models.source import Source
from app.schemas.article import ArticleAdminOut, ApproveRequest, RejectRequest
from app.schemas.digest import DigestOut
from app.schemas.source import SourceAdminOut, SourceUpdate
from app.auth import hash_password, verify_password

router = APIRouter(prefix="/admin", tags=["admin"])

_api_key_header = APIKeyHeader(name="X-Admin-Token", auto_error=False)


def _check_token(token: str = Security(_api_key_header)):
    if token != settings.ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Invalid admin token")


# ── Authentication ────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class ResetPasswordRequest(BaseModel):
    new_password: str


@router.post("/reset-admin-password")
def reset_admin_password(body: ResetPasswordRequest, db: Session = Depends(get_db), token: str = Security(_api_key_header)):
    if token != settings.ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Invalid admin token")
    user = db.query(AdminUser).filter(AdminUser.username == "admin").first()
    if not user:
        raise HTTPException(status_code=404, detail="Admin user not found")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True, "message": "Admin password updated"}



@router.post("/login")
def admin_login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(AdminUser).filter(
        AdminUser.username == body.username,
        AdminUser.is_active.is_(True),
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    password_ok = verify_password(body.password, user.password_hash)

    if not password_ok:
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
        if field == "scrape_config" and isinstance(value, dict):
            setattr(source, field, json.dumps(value))
        else:
            setattr(source, field, value)
    db.commit()
    db.refresh(source)
    return source


@router.delete("/sources/{source_id}", dependencies=[Depends(_check_token)])
def delete_source(source_id: int, db: Session = Depends(get_db)):
    from app.models.daily_digest import DailyDigest, DigestArticle
    import traceback
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

    try:
        # Collect article IDs belonging to this source
        article_ids = [row[0] for row in db.query(Article.id).filter(Article.source_id == source_id).all()]

        if article_ids:
            db.query(DigestArticle).filter(DigestArticle.article_id.in_(article_ids)).delete(synchronize_session=False)
            db.query(DailyDigest).filter(DailyDigest.top_story_id.in_(article_ids)).update(
                {"top_story_id": None}, synchronize_session=False
            )
            db.query(Article).filter(Article.source_id == source_id).delete(synchronize_session=False)

        db.query(ScrapeRun).filter(ScrapeRun.source_id == source_id).delete(synchronize_session=False)
        db.delete(source)
        db.commit()
        return {"deleted": source_id}
    except Exception as exc:
        db.rollback()
        logger.error("Failed to delete source %d: %s", source_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error")


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


# ── Model Chain Editor ────────────────────────────────────────────────────────

@router.get("/model-chain", dependencies=[Depends(_check_token)])
def get_model_chain():
    from app.ai.chain_config import load, DEFAULT_NVIDIA_CHAIN
    from app.ai import client as ai_client

    config = load()
    # Use live instance order if available (reflects in-session changes)
    if ai_client._nvidia_mx:
        live_chain = [m.name for m in ai_client._nvidia_mx.models]
    else:
        live_chain = config.get("nvidia_chain") or DEFAULT_NVIDIA_CHAIN

    return {
        "nvidia_chain": live_chain,
        "openrouter_model": ai_client.get_openrouter_model(),
        "default_chain": DEFAULT_NVIDIA_CHAIN,
    }


@router.put("/model-chain", dependencies=[Depends(_check_token)])
def update_model_chain(body: dict):
    from app.ai.chain_config import load, save
    from app.ai import client as ai_client

    config = load()

    if "nvidia_chain" in body:
        chain = [str(m).strip() for m in body["nvidia_chain"] if str(m).strip()]
        if not chain:
            raise HTTPException(status_code=400, detail="Chain must have at least one model")
        config["nvidia_chain"] = chain
        # Apply to live instance immediately
        if ai_client._nvidia_mx:
            from app.ai.nvidia_multiplex import _ModelState
            ai_client._nvidia_mx.models = [_ModelState(m) for m in chain]
            ai_client._multiplex = ai_client._nvidia_mx

    if "openrouter_model" in body:
        model = str(body["openrouter_model"]).strip()
        if model:
            config["openrouter_model"] = model
            ai_client.set_openrouter_model(model)

    save(config)
    return config


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


# ── Global App Config ─────────────────────────────────────────────────────────

@router.get("/config", dependencies=[Depends(_check_token)])
def get_app_config():
    from app.config_store import get_max_articles_per_source
    return {"max_articles_per_source": get_max_articles_per_source()}


@router.patch("/config", dependencies=[Depends(_check_token)])
def update_app_config(body: dict = Body(...)):
    from app.config_store import set_setting, get_max_articles_per_source
    if "max_articles_per_source" in body:
        set_setting("max_articles_per_source", max(1, int(body["max_articles_per_source"])))
    return {"max_articles_per_source": get_max_articles_per_source()}


# ── Scheduler Config ──────────────────────────────────────────────────────────

# ── SEO config ────────────────────────────────────────────────────────────────

@router.get("/seo", dependencies=[Depends(_check_token)])
def get_seo():
    from app.config_store import get_seo_config
    return get_seo_config()


@router.patch("/seo", dependencies=[Depends(_check_token)])
def update_seo(config: dict = Body(...)):
    from app.config_store import save_seo_config, get_seo_config, DEFAULT_SEO_CONFIG
    allowed = set(DEFAULT_SEO_CONFIG.keys())
    save_seo_config({k: v for k, v in config.items() if k in allowed})
    return get_seo_config()


@router.get("/scheduler", dependencies=[Depends(_check_token)])
def get_scheduler():
    from app.config_store import get_schedule
    return get_schedule()


@router.put("/scheduler", dependencies=[Depends(_check_token)])
def update_scheduler(config: dict = Body(...)):
    from app.config_store import save_schedule, get_schedule
    allowed = {"scrape_hour", "scrape_minute", "digest_hour", "digest_minute", "enabled"}
    save_schedule({k: v for k, v in config.items() if k in allowed})
    current = get_schedule()

    # Reschedule running APScheduler jobs if scheduler is available
    try:
        from app.main import scheduler as _sched
        from apscheduler.triggers.cron import CronTrigger

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
        .options(joinedload(Article.source))
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
async def scrape_events(
    request: Request,
    token: str | None = Query(None),
    since: int = Query(0),
    run_id: int | None = Query(None),
):
    """SSE endpoint — streams scrape progress events for a given run.

    If run_id is provided, streams that specific run's events from in-memory state
    (and falls back to the persisted events_json if the run is no longer in memory).
    If run_id is omitted, streams the most recently active run (legacy behaviour).
    Pass ?since=N to resume from a known event index.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        auth_token = auth_header[7:]
    elif token:
        auth_token = token
    else:
        raise HTTPException(status_code=401, detail="Token required (Authorization header or ?token=)")

    if auth_token != settings.ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Invalid token")

    from app.ai import progress

    # If no run_id given, pick the most recently active one (legacy behaviour)
    target_run_id = run_id
    if target_run_id is None:
        actives = progress.list_active_run_ids()
        if actives:
            target_run_id = max(actives)

    async def generate():
        index = max(0, since)
        idle_ticks = 0
        # Idle timeout: 60 minutes (7200 ticks × 0.5s). Heartbeat keeps the
        # connection alive without flooding event log.
        while idle_ticks < 7200:
            if target_run_id is not None:
                events = progress.get_events(target_run_id, index)
            else:
                events = []
            for event in events:
                yield f"data: {json.dumps(event)}\n\n"
                index += 1
                idle_ticks = 0
                if event.get("kind") == "done":
                    return
            # If the run is finished and not in memory, fetch the persisted JSON once and replay.
            if target_run_id is not None and idle_ticks > 4 and not progress.is_active(target_run_id):
                from app.models.pipeline_run import PipelineRun
                from app.database import SessionLocal as _SL
                _db = _SL()
                try:
                    row = _db.query(PipelineRun).filter(PipelineRun.id == target_run_id).first()
                    if row and row.events_json:
                        try:
                            stored = json.loads(row.events_json)
                            for event in stored[index:]:
                                yield f"data: {json.dumps(event)}\n\n"
                                index += 1
                                if event.get("kind") == "done":
                                    return
                        except Exception:
                            pass
                finally:
                    _db.close()
                # Send a synthetic done so the client closes cleanly
                yield f"data: {json.dumps({'message': 'Run finished', 'kind': 'done', 'ts': time.time()})}\n\n"
                return
            # Heartbeat every 15s (30 ticks) to keep proxies/browsers from closing the stream
            if idle_ticks > 0 and idle_ticks % 30 == 0:
                yield ": heartbeat\n\n"
            idle_ticks += 1
            await asyncio.sleep(0.5)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Manual Triggers ───────────────────────────────────────────────────────────

# Per-source-slug active-run tracking. Multiple distinct slugs may run in parallel,
# but a given slug (including "all") cannot start a second run while the first is active.
_active_slugs: set[str] = set()
_active_slugs_lock = threading.Lock()


@router.post("/trigger-scrape", dependencies=[Depends(_check_token)])
async def trigger_scrape(source_slug: str = "all"):
    import asyncio
    from app.pipeline.orchestrator import run_scrape_pipeline

    with _active_slugs_lock:
        if source_slug in _active_slugs:
            raise HTTPException(
                status_code=429,
                detail=f"A scrape for '{source_slug}' is already running.",
            )
        if "all" in _active_slugs and source_slug != "all":
            raise HTTPException(
                status_code=429,
                detail="An 'all-sources' scrape is currently running. Wait for it to finish.",
            )
        if source_slug == "all" and _active_slugs:
            raise HTTPException(
                status_code=429,
                detail="Per-source scrapes are running. Wait or cancel them before starting an 'all' run.",
            )
        _active_slugs.add(source_slug)

    # Capture the new run id so the client can immediately subscribe to it.
    started_event = threading.Event()
    captured: dict = {}

    def _run_in_thread():
        try:
            # Hook into progress.start so we can grab the run id as soon as the
            # orchestrator registers it. Replace momentarily, restore in finally.
            from app.ai import progress as _prog
            original_start = _prog.start

            def _start_capture(run_id: int):
                captured["run_id"] = run_id
                started_event.set()
                return original_start(run_id)

            _prog.start = _start_capture  # type: ignore[assignment]
            try:
                asyncio.run(run_scrape_pipeline(source_slug))
            finally:
                _prog.start = original_start  # type: ignore[assignment]
                started_event.set()  # ensure waiter unblocks even on early failure
        finally:
            with _active_slugs_lock:
                _active_slugs.discard(source_slug)

    threading.Thread(target=_run_in_thread, daemon=True).start()
    started_event.wait(timeout=2.0)
    return {
        "message": f"Scrape triggered for '{source_slug}'",
        "run_id": captured.get("run_id"),
    }


@router.post("/pipeline-runs/{run_id}/cancel", dependencies=[Depends(_check_token)])
def cancel_pipeline_run(run_id: int):
    """Request cooperative cancellation of an active pipeline run."""
    from app.ai import progress
    if not progress.request_cancel(run_id):
        raise HTTPException(status_code=404, detail="Run not active or not found")
    return {"message": f"Cancellation requested for run {run_id}", "run_id": run_id}


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
        .options(joinedload(ScrapeRun.source))
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


# ── Pipeline Runs (persistent log) ───────────────────────────────────────────

@router.get("/pipeline-runs/active", dependencies=[Depends(_check_token)])
def get_active_pipeline_runs(db: Session = Depends(get_db)):
    """Return all currently running PipelineRuns (parallel runs supported)."""
    from app.ai import progress
    active_ids = progress.list_active_run_ids()
    if not active_ids:
        return {"active": [], "active_run": None}
    runs = (
        db.query(PipelineRun)
        .filter(PipelineRun.id.in_(active_ids))
        .order_by(PipelineRun.started_at.desc())
        .all()
    )
    rows = [
        {
            "id": r.id,
            "started_at": r.started_at,
            "source_slug": r.source_slug,
            "status": r.status,
            "total_found": r.total_found,
            "total_new": r.total_new,
            "total_ai_processed": r.total_ai_processed,
        }
        for r in runs
    ]
    # Backwards-compat: `active` was singular before. Keep both shapes.
    return {"active": rows, "active_run": rows[0] if rows else None}


def _compute_stats(events: list[dict]) -> dict:
    """Aggregate per-kind counters and per-phase timing for a run's event log."""
    found = analyzed = published = skipped = errors = 0
    clustered_extra = 0
    phases: dict[str, dict] = {}
    for ev in events:
        k = ev.get("kind")
        ts = ev.get("ts")
        if k == "found":
            found += 1
        elif k == "scored":
            analyzed += 1
        elif k == "publish":
            published += 1
        elif k == "skipped":
            skipped += 1
        elif k == "error":
            errors += 1
        elif k == "clustered":
            clustered_extra += max(0, int(ev.get("cluster_size") or 1) - 1)
        if ts is not None and k in ("source_start", "fetch_start", "fetch_done", "ai_batch_start",
                                     "analyzing", "rewriting", "publish", "scored", "found",
                                     "source_done", "done", "info"):
            phases.setdefault(k, {"first": ts, "last": ts, "count": 0})
            phases[k]["last"] = ts
            phases[k]["count"] += 1

    # Compute simple phase durations
    timing = {}
    if events:
        start_ts = events[0].get("ts")
        end_ts = events[-1].get("ts")
        if start_ts and end_ts:
            timing["total_seconds"] = round(end_ts - start_ts, 1)
    # Scrape phase: source_start..source_done
    if "source_start" in phases and "source_done" in phases:
        timing["scrape_seconds"] = round(phases["source_done"]["last"] - phases["source_start"]["first"], 1)
    # AI phase: ai_batch_start..(last publish or done)
    if "ai_batch_start" in phases:
        end = phases.get("done", {}).get("last") or phases.get("publish", {}).get("last") or phases["ai_batch_start"]["last"]
        timing["ai_seconds"] = round(end - phases["ai_batch_start"]["first"], 1)

    pass_rate = round((published / analyzed) * 100) if analyzed else None
    return {
        "found": found,
        "analyzed": analyzed,
        "published": published,
        "skipped": skipped,
        "errors": errors,
        "clustered_extra": clustered_extra,
        "pass_rate": pass_rate,
        "timing": timing,
    }


@router.get("/pipeline-runs/{run_id}", dependencies=[Depends(_check_token)])
def get_pipeline_run(run_id: int, db: Session = Depends(get_db)):
    """Return a single PipelineRun including its events_json + computed stats."""
    run = db.query(PipelineRun).filter(PipelineRun.id == run_id).first()
    if run is None:
        raise HTTPException(status_code=404, detail="Pipeline run not found")
    events = json.loads(run.events_json) if run.events_json else []
    return {
        "id": run.id,
        "started_at": run.started_at,
        "completed_at": run.completed_at,
        "status": run.status,
        "source_slug": run.source_slug,
        "total_found": run.total_found,
        "total_new": run.total_new,
        "total_ai_processed": run.total_ai_processed,
        "input_tokens": run.input_tokens,
        "output_tokens": run.output_tokens,
        "error_message": run.error_message,
        "events": events,
        "stats": _compute_stats(events),
    }


@router.get("/pipeline-runs", dependencies=[Depends(_check_token)])
def list_pipeline_runs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Return recent pipeline runs (without events_json — use /{id} for events)."""
    runs = (
        db.query(PipelineRun)
        .order_by(PipelineRun.started_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return [
        {
            "id": r.id,
            "started_at": r.started_at,
            "completed_at": r.completed_at,
            "status": r.status,
            "source_slug": r.source_slug,
            "total_found": r.total_found,
            "total_new": r.total_new,
            "total_ai_processed": r.total_ai_processed,
            "input_tokens": r.input_tokens,
            "output_tokens": r.output_tokens,
            "error_message": r.error_message,
        }
        for r in runs
    ]


# ── Pipeline Config ───────────────────────────────────────────────────────────

@router.get("/pipeline/config", dependencies=[Depends(_check_token)])
def get_pipeline_config():
    from app.config_store import get_pipeline_config as _get
    return _get()


@router.patch("/pipeline/config", dependencies=[Depends(_check_token)])
def update_pipeline_config(config: dict = Body(...)):
    from app.config_store import save_pipeline_config
    allowed = {"cutoff_hours", "dedup_threshold", "confidence_reject_threshold",
                "feature_min_score", "top_featured", "scrape_concurrency", "ai_batch_size",
                "max_articles_per_source", "max_articles_per_run"}
    save_pipeline_config({k: v for k, v in config.items() if k in allowed})
    from app.config_store import get_pipeline_config as _get
    return _get()


@router.get("/pipeline/stats", dependencies=[Depends(_check_token)])
def get_pipeline_stats(db: Session = Depends(get_db)):
    from sqlalchemy import func
    rows = db.query(Article.status, func.count(Article.id)).group_by(Article.status).all()
    return {status: count for status, count in rows}


@router.get("/pipeline/prompts", dependencies=[Depends(_check_token)])
def get_pipeline_prompts():
    from app.config_store import get_prompt
    from app.ai.prompts import QUALITY_CHECK_PROMPT, ENRICH_PROMPT
    return {
        "quality_check": {"current": get_prompt("quality_check") or QUALITY_CHECK_PROMPT, "is_custom": get_prompt("quality_check") is not None, "default": QUALITY_CHECK_PROMPT},
        "enrich": {"current": get_prompt("enrich") or ENRICH_PROMPT, "is_custom": get_prompt("enrich") is not None, "default": ENRICH_PROMPT},
    }


class PromptUpdate(BaseModel):
    key: str
    text: str


@router.put("/pipeline/prompts", dependencies=[Depends(_check_token)])
def update_pipeline_prompt(body: PromptUpdate):
    if body.key not in ("quality_check", "enrich"):
        raise HTTPException(status_code=400, detail="Invalid prompt key")
    from app.config_store import save_prompt
    save_prompt(body.key, body.text)
    return {"ok": True}


@router.delete("/pipeline/prompts/{key}", dependencies=[Depends(_check_token)])
def reset_pipeline_prompt(key: str):
    if key not in ("quality_check", "enrich"):
        raise HTTPException(status_code=400, detail="Invalid prompt key")
    from app.config_store import reset_prompt
    reset_prompt(key)
    return {"ok": True, "message": "Prompt reset to default"}
