"""
SEO endpoints: sitemap.xml, robots.txt, bot meta-tag injection, and
RFC 8288 agent-discovery Link headers + /.well-known/api-catalog.

Bot detection is intentionally lenient: any UA matching the BOT_PATTERNS regex
gets server-rendered HTML with full meta tags. Real users get the unmodified
SPA shell. This is "dynamic rendering" — explicitly supported by Google, not
cloaking, since the same content is delivered in a different format.
"""
import json
import re
import xml.sax.saxutils as xml_escape
from datetime import datetime
from html import escape as html_escape
from typing import Optional

from fastapi import APIRouter
from fastapi.responses import JSONResponse, PlainTextResponse, Response

from app.config_store import get_seo_config
from app.database import SessionLocal
from app.models.article import Article
from app.models.daily_digest import DailyDigest

router = APIRouter(tags=["seo"])

BOT_PATTERNS = re.compile(
    r"googlebot|bingbot|yandex|baiduspider|duckduckbot|applebot|"
    r"twitterbot|facebookexternalhit|linkedinbot|slackbot|"
    r"whatsapp|telegrambot|discordbot|skypeuripreview|"
    r"gptbot|claudebot|perplexitybot|anthropic-ai|chatgpt-user|cohere-ai|"
    r"redditbot|pinterest|mastodon|bsky|"
    r"embedly|nuzzel|qwantify|ia_archiver|archive\.org_bot",
    re.IGNORECASE,
)


def is_bot(user_agent: str) -> bool:
    if not user_agent:
        return False
    return bool(BOT_PATTERNS.search(user_agent))


# ── Meta injection ────────────────────────────────────────────────────────────

def _esc(s: Optional[str]) -> str:
    return html_escape(s or "", quote=True)


def _strip_html(s: Optional[str]) -> str:
    if not s:
        return ""
    return re.sub(r"<[^>]+>", "", s)[:300].strip()


def _abs_url(path: str, base: str) -> str:
    if not path:
        return ""
    if path.startswith("http://") or path.startswith("https://"):
        return path
    if not path.startswith("/"):
        path = "/" + path
    return base.rstrip("/") + path


def _build_meta_block(*, title: str, description: str, canonical: str,
                     image: str, og_type: str = "website",
                     extra_jsonld: Optional[dict] = None) -> str:
    cfg = get_seo_config()
    site_name = cfg["site_name"]
    twitter = cfg.get("twitter_handle", "")

    parts = [
        f'<title>{_esc(title)}</title>',
        f'<meta name="description" content="{_esc(description)}" />',
        f'<link rel="canonical" href="{_esc(canonical)}" />',
        f'<meta property="og:type" content="{og_type}" />',
        f'<meta property="og:title" content="{_esc(title)}" />',
        f'<meta property="og:description" content="{_esc(description)}" />',
        f'<meta property="og:url" content="{_esc(canonical)}" />',
        f'<meta property="og:site_name" content="{_esc(site_name)}" />',
        f'<meta property="og:image" content="{_esc(image)}" />',
        f'<meta name="twitter:card" content="summary_large_image" />',
        f'<meta name="twitter:title" content="{_esc(title)}" />',
        f'<meta name="twitter:description" content="{_esc(description)}" />',
        f'<meta name="twitter:image" content="{_esc(image)}" />',
    ]
    if twitter:
        parts.append(f'<meta name="twitter:site" content="{_esc(twitter)}" />')

    if extra_jsonld:
        parts.append(f'<script type="application/ld+json">{json.dumps(extra_jsonld, ensure_ascii=False)}</script>')

    return "\n    ".join(parts)


def _inject_into_html(html: str, meta_block: str) -> str:
    # Remove existing static <title> and <meta name="description"> from index.html
    html = re.sub(r'<title>.*?</title>', '', html, count=1, flags=re.DOTALL)
    html = re.sub(r'<meta\s+name="description"[^>]*/?>', '', html, count=1)
    # Inject before </head>
    return html.replace("</head>", f"    {meta_block}\n  </head>", 1)


def render_for_bot(path: str, base_url: str, html_shell: str) -> Optional[str]:
    """Return server-rendered HTML for the given path, or None if not handled."""
    cfg = get_seo_config()
    db = SessionLocal()
    try:
        # /articles/:id
        m = re.match(r"^/articles/(\d+)/?$", path)
        if m:
            article_id = int(m.group(1))
            article = db.query(Article).filter(
                Article.id == article_id,
                Article.status == "published",
            ).first()
            if not article:
                return None
            canonical = f"{base_url.rstrip('/')}/articles/{article.id}"
            image = article.image_url or _abs_url(cfg["default_og_image"], base_url)
            description = _strip_html(article.summary) or cfg["site_description"]
            jsonld = {
                "@context": "https://schema.org",
                "@type": "NewsArticle",
                "headline": article.title,
                "description": description,
                "image": image,
                "datePublished": (article.published_at or article.created_at).isoformat() if (article.published_at or article.created_at) else None,
                "dateModified": (article.approved_at or article.created_at).isoformat() if (article.approved_at or article.created_at) else None,
                "author": {"@type": "Organization", "name": article.source.name if article.source else cfg["publisher_name"]},
                "publisher": {"@type": "Organization", "name": cfg["publisher_name"]},
                "mainEntityOfPage": canonical,
            }
            meta = _build_meta_block(
                title=f"{article.title} — {cfg['site_name']}",
                description=description,
                canonical=canonical,
                image=image,
                og_type="article",
                extra_jsonld=jsonld,
            )
            body_intro = _esc(_strip_html(article.summary)[:500])
            body_html = f"""
            <article>
              <h1>{_esc(article.title)}</h1>
              <p>{body_intro}</p>
              <p><a href="{_esc(article.url)}" rel="noopener">Read original at {_esc(article.source.name) if article.source else 'source'}</a></p>
            </article>
            """
            html = _inject_into_html(html_shell, meta)
            html = html.replace('<div id="root"></div>', f'<div id="root">{body_html}</div>', 1)
            return html

        # /digest/:date or /digest
        m = re.match(r"^/digest(?:/(\d{4}-\d{2}-\d{2}))?/?$", path)
        if m:
            date_str = m.group(1)
            q = db.query(DailyDigest).filter(DailyDigest.status == "published")
            if date_str:
                from datetime import date as _date
                try:
                    d = _date.fromisoformat(date_str)
                    digest = q.filter(DailyDigest.digest_date == d).first()
                except ValueError:
                    digest = None
            else:
                digest = q.order_by(DailyDigest.digest_date.desc()).first()
            if not digest:
                return None
            canonical = f"{base_url.rstrip('/')}/digest/{digest.digest_date.isoformat()}"
            image = _abs_url(cfg["default_og_image"], base_url)
            description = _strip_html(digest.intro) or cfg["site_description"]
            meta = _build_meta_block(
                title=f"{digest.headline} — {cfg['site_name']} Daily Digest",
                description=description,
                canonical=canonical,
                image=image,
            )
            return _inject_into_html(html_shell, meta)

        # /topics, /sources, /  → use site defaults
        if path in ("/", "/topics", "/sources"):
            canonical = f"{base_url.rstrip('/')}{path}"
            meta = _build_meta_block(
                title=cfg["site_title"],
                description=cfg["site_description"],
                canonical=canonical,
                image=_abs_url(cfg["default_og_image"], base_url),
            )
            return _inject_into_html(html_shell, meta)

        return None
    finally:
        db.close()


# ── sitemap.xml ────────────────────────────────────────────────────────────────

@router.get("/sitemap.xml", response_class=Response)
def sitemap():
    cfg = get_seo_config()
    base = cfg["site_url"].rstrip("/")
    db = SessionLocal()
    try:
        urls: list[tuple[str, Optional[datetime], str, str]] = [
            (f"{base}/", None, "hourly", "1.0"),
            (f"{base}/digest", None, "daily", "0.9"),
            (f"{base}/topics", None, "weekly", "0.6"),
            (f"{base}/sources", None, "weekly", "0.5"),
        ]
        articles = (
            db.query(Article)
            .filter(Article.status == "published")
            .order_by(Article.approved_at.desc().nullslast())
            .limit(5000)
            .all()
        )
        for a in articles:
            lastmod = a.approved_at or a.published_at or a.created_at
            urls.append((f"{base}/articles/{a.id}", lastmod, "weekly", "0.7"))

        digests = db.query(DailyDigest).filter(DailyDigest.status == "published").all()
        for d in digests:
            urls.append((f"{base}/digest/{d.digest_date.isoformat()}", d.approved_at, "monthly", "0.8"))

        lines = ['<?xml version="1.0" encoding="UTF-8"?>',
                 '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
        for url, lastmod, changefreq, priority in urls:
            entry = ["  <url>", f"    <loc>{xml_escape.escape(url)}</loc>"]
            if lastmod:
                entry.append(f"    <lastmod>{lastmod.strftime('%Y-%m-%d')}</lastmod>")
            entry.append(f"    <changefreq>{changefreq}</changefreq>")
            entry.append(f"    <priority>{priority}</priority>")
            entry.append("  </url>")
            lines.append("\n".join(entry))
        lines.append("</urlset>")

        return Response(
            content="\n".join(lines),
            media_type="application/xml",
            headers={"Cache-Control": "public, max-age=3600"},
        )
    finally:
        db.close()


# ── Agent-discovery Link headers (RFC 8288) ────────────────────────────────────

_LINK_RELS = [
    '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
    '</.well-known/oauth-authorization-server>; rel="oauth-authorization-server"',
    '</sitemap.xml>; rel="sitemap"',
    '</docs>; rel="service-doc"',
    '</api/v1/health>; rel="service"',
]

AGENT_LINK_HEADER = ", ".join(_LINK_RELS)


@router.get("/.well-known/api-catalog")
def api_catalog():
    """
    RFC 9727 API catalog in RFC 9264 Linkset format.
    Content-Type: application/linkset+json
    """
    cfg = get_seo_config()
    base = cfg["site_url"].rstrip("/")

    # RFC 9264 §4.2 — linkset object; each relation value is an array of {href, type?}.
    linkset = {
        "linkset": [
            {
                "anchor": f"{base}/api/v1",
                "service-desc": [
                    {
                        "href": f"{base}/openapi.json",
                        "type": "application/vnd.oai.openapi+json;version=3.0",
                    }
                ],
                "service-doc": [
                    {"href": f"{base}/docs"}
                ],
                "status": [
                    {"href": f"{base}/api/v1/health"}
                ],
                # RFC 8414 authorization server metadata for this API
                "oauth-authorization-server": [
                    {"href": f"{base}/.well-known/oauth-authorization-server"}
                ],
            }
        ]
    }
    return Response(
        content=json.dumps(linkset),
        media_type="application/linkset+json",
        headers={
            "Cache-Control": "public, max-age=86400",
            "Link": AGENT_LINK_HEADER,
        },
    )


# ── OAuth 2.0 Authorization Server Metadata (RFC 8414) ────────────────────────

@router.get("/.well-known/oauth-authorization-server")
def oauth_authorization_server():
    """
    RFC 8414 Authorization Server Metadata.

    Daily AI Bird public APIs (/api/v1/articles, /digests, /topics, /sources)
    require no credentials. Admin APIs use a pre-issued API key in the
    X-Admin-Token header — not a standard OAuth flow.

    This document is published for agent discoverability and to explicitly
    declare that no OAuth token issuance is in use.
    """
    cfg = get_seo_config()
    base = cfg["site_url"].rstrip("/")

    metadata = {
        # Required by RFC 8414
        "issuer": base,

        # No OAuth authorization code, implicit, or client-credentials flow.
        # Public API endpoints need no credentials at all.
        "grant_types_supported": [],
        "response_types_supported": [],
        "token_endpoint_auth_methods_supported": [],
        "scopes_supported": [],

        # Service documentation pointers
        "service_documentation": f"{base}/docs",
        "op_policy_uri": f"{base}/terms",
        "op_tos_uri": f"{base}/terms",
        "ui_locales_supported": ["en"],

        # Extension: describe the two access tiers so agents know what to expect.
        # Not part of RFC 8414 core but follows the x_ extension convention.
        "x_access_tiers": {
            "public": {
                "base_url": f"{base}/api/v1",
                "resources": ["articles", "digests", "topics", "sources", "health"],
                "auth_required": False,
                "note": "No credentials needed. Read-only access to published content.",
            },
            "admin": {
                "base_url": f"{base}/api/v1/admin",
                "auth_required": True,
                "auth_scheme": "ApiKey",
                "auth_header": "X-Admin-Token",
                "note": (
                    "Pre-issued static API key required. "
                    "Not an OAuth flow — contact the site operator to obtain a key."
                ),
            },
        },
    }
    return JSONResponse(
        content=metadata,
        headers={
            "Cache-Control": "public, max-age=86400",
            "Link": AGENT_LINK_HEADER,
        },
    )


# ── robots.txt ─────────────────────────────────────────────────────────────────

@router.get("/robots.txt", response_class=PlainTextResponse)
def robots():
    cfg = get_seo_config()
    base = cfg["site_url"].rstrip("/")
    extra = cfg.get("robots_extra", "") or ""

    # Build Content-Signal directive (draft-romm-aipref-contentsignals)
    cs_parts = [
        f"search={cfg.get('cs_search', 'yes')}",
        f"ai-train={cfg.get('cs_ai_train', 'no')}",
        f"ai-input={cfg.get('cs_ai_input', 'no')}",
    ]
    content_signal = ", ".join(cs_parts)

    body = f"""User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /api/

# Content usage preferences (https://contentsignals.org/)
Content-Signal: {content_signal}

Sitemap: {base}/sitemap.xml
"""
    if extra.strip():
        body += "\n" + extra.strip() + "\n"
    return PlainTextResponse(body, headers={"Cache-Control": "public, max-age=3600"})
