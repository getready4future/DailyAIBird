"""
SEO endpoints: sitemap.xml, robots.txt, bot meta-tag injection, and
RFC 8288 agent-discovery Link headers + /.well-known/api-catalog.

Bot detection is intentionally lenient: any UA matching the BOT_PATTERNS regex
gets server-rendered HTML with full meta tags. Real users get the unmodified
SPA shell. This is "dynamic rendering" — explicitly supported by Google, not
cloaking, since the same content is delivered in a different format.
"""
import hashlib
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


# ── Markdown-for-Agents content negotiation ────────────────────────────────────

def _md_strip(s: Optional[str]) -> str:
    """Strip HTML tags and return plain text for Markdown embedding."""
    if not s:
        return ""
    return re.sub(r"<[^>]+>", "", s).strip()


def _score_line(a) -> str:
    parts = []
    for label, val in [("Relevance", a.relevance_score), ("Impact", a.impact_score),
                       ("Curiosity", a.curiosity_score)]:
        parts.append(f"{label}: {val:.1f}" if val is not None else f"{label}: n/a")
    parts.append(f"Momentum: {a.momentum_score}")
    return " · ".join(parts)


def render_markdown_for_agent(path: str, base_url: str) -> Optional[str]:
    """
    Return Markdown content for AI agent requests (Accept: text/markdown),
    or None if the path is not handled.
    """
    cfg = get_seo_config()
    base = base_url.rstrip("/")
    db = SessionLocal()
    try:
        # /articles/:id
        m = re.match(r"^/articles/(\d+)/?$", path)
        if m:
            article = db.query(Article).filter(
                Article.id == int(m.group(1)), Article.status == "published"
            ).first()
            if not article:
                return None
            lines = [
                f"# {article.title}",
                "",
                f"**Source:** [{article.source.name}]({article.source.url})"
                + (f"  \n**Author:** {article.author}" if article.author else ""),
                f"**Topic:** {article.topic or 'general'}",
                f"**Published:** {article.published_at.strftime('%Y-%m-%d') if article.published_at else 'unknown'}",
                f"**Scores:** {_score_line(article)}",
                "",
                "> ⚠ AI-assisted summary, reviewed by editors. "
                "Always read the original before citing or acting on this information.",
                "",
            ]
            if article.summary:
                lines += ["## Summary", "", _md_strip(article.summary), ""]
            if article.tags:
                lines += ["**Tags:** " + "  ".join(f"`{t}`" for t in article.tags), ""]
            lines += [
                "---",
                "",
                f"- [Read original article at {article.source.name}]({article.url})",
                f"- [View on Daily AI Bird]({base}/articles/{article.id})",
            ]
            return "\n".join(lines)

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

            lines = [
                f"# Daily AI Bird Digest — {digest.digest_date.isoformat()}",
                "",
                f"**Headline:** {digest.headline}",
                f"**Articles covered:** {digest.article_count}",
                f"**URL:** {base}/digest/{digest.digest_date.isoformat()}",
                "",
            ]
            if digest.intro:
                lines += [_md_strip(digest.intro), ""]

            sections = digest.sections if isinstance(digest.sections, list) else []
            for section in sections:
                heading = section.get("heading") or section.get("topic", "Section")
                lines += [f"## {heading}", ""]
                for item in section.get("items", []):
                    lines.append(f"- **{item.get('title', '')}**")
                    if item.get("one_liner"):
                        lines.append(f"  {item['one_liner']}")
                lines.append("")
            return "\n".join(lines)

        # / — recent articles feed
        if path in ("/", ""):
            from sqlalchemy import func as _func
            q = db.query(Article).filter(Article.status == "published")
            momentum_boost = _func.least(_func.coalesce(Article.momentum_score, 1), 5) / 5.0
            score_expr = (
                _func.coalesce(Article.relevance_score, 0) * 0.35
                + _func.coalesce(Article.impact_score, 0) * 0.25
                + _func.coalesce(Article.curiosity_score, 0) * 0.25
                + momentum_boost * 0.15
            )
            articles = q.order_by(score_expr.desc(), Article.published_at.desc()).limit(20).all()

            lines = [
                f"# {cfg['site_title']}",
                "",
                f"> {cfg['site_description']}",
                "",
                "AI-assisted, editor-reviewed news intelligence. "
                "Summaries generated by Claude · reviewed by humans.",
                "",
                "## Top Stories",
                "",
            ]
            for a in articles:
                pub = a.published_at.strftime("%Y-%m-%d") if a.published_at else "unknown"
                lines.append(
                    f"### [{a.title}]({base}/articles/{a.id})"
                )
                lines.append(
                    f"**{a.source.name}** · {pub}"
                    + (f" · {a.topic}" if a.topic else "")
                    + f" · {_score_line(a)}"
                )
                if a.summary:
                    lines.append("")
                    lines.append(_md_strip(a.summary)[:200] + ("…" if len(a.summary) > 200 else ""))
                lines.append("")
            return "\n".join(lines)

        # /topics
        if path == "/topics":
            from sqlalchemy import func as _func
            rows = (
                db.query(Article.topic, _func.count(Article.id))
                .filter(Article.status == "published", Article.topic.isnot(None))
                .group_by(Article.topic)
                .order_by(_func.count(Article.id).desc())
                .all()
            )
            lines = [
                "# Daily AI Bird — Topics",
                "",
                "Available topic categories with article counts:",
                "",
            ]
            for topic, count in rows:
                lines.append(f"- [{topic}]({base}/?topic={topic}) — {count} articles")
            lines += ["", f"[← Back to feed]({base}/)"]
            return "\n".join(lines)

        return None
    finally:
        db.close()


def wants_markdown(accept_header: str) -> bool:
    """Return True when the request explicitly asks for text/markdown."""
    return "text/markdown" in accept_header


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
    '</.well-known/oauth-protected-resource>; rel="oauth-protected-resource"',
    '</.well-known/mcp/server-card.json>; rel="mcp-server-card"',
    '</.well-known/agent-skills/index.json>; rel="agent-skills"',
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
                # RFC 9728 protected resource metadata
                "oauth-protected-resource": [
                    {"href": f"{base}/.well-known/oauth-protected-resource"}
                ],
                # SEP-1649 MCP server card
                "mcp-server-card": [
                    {"href": f"{base}/.well-known/mcp/server-card.json", "type": "application/json"}
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


# ── OAuth 2.0 Protected Resource Metadata (RFC 9728) ──────────────────────────

@router.get("/.well-known/oauth-protected-resource")
def oauth_protected_resource():
    """
    RFC 9728 OAuth 2.0 Protected Resource Metadata.

    Describes this resource server — which authorization server can issue
    tokens for it, what scopes are supported, and how credentials are
    conveyed. Published so agents can programmatically discover how to
    authenticate before calling the API.
    """
    cfg = get_seo_config()
    base = cfg["site_url"].rstrip("/")

    metadata = {
        # Required (RFC 9728 §2): URI that identifies this protected resource.
        "resource": f"{base}/api/v1",

        # The authorization server(s) that can issue credentials for this resource.
        # Our AS metadata (RFC 8414) is at /.well-known/oauth-authorization-server
        # and explicitly states no OAuth token issuance — public API needs no token,
        # admin API uses a pre-issued API key delivered in X-Admin-Token.
        "authorization_servers": [base],

        # No OAuth scopes are used; access tiers are controlled by API key presence.
        "scopes_supported": [],

        # Admin API key is sent in a request header (X-Admin-Token).
        # "header" is the closest RFC 9728 §2 bearer_methods value.
        # Note: the header name is X-Admin-Token, not Authorization: Bearer.
        "bearer_methods_supported": ["header"],

        # Documentation pointers
        "resource_documentation": f"{base}/docs",
        "resource_policy_uri": f"{base}/terms",
        "resource_tos_uri": f"{base}/terms",

        # Extension (x_ prefix per RFC 9728 §4.1): per-tier credential details
        # so agents know which paths are open vs. key-gated.
        "x_access_tiers": [
            {
                "name": "public",
                "base_url": f"{base}/api/v1",
                "paths": [
                    "/api/v1/articles",
                    "/api/v1/digests",
                    "/api/v1/topics",
                    "/api/v1/sources",
                    "/api/v1/health",
                ],
                "auth_required": False,
                "note": "No credentials needed. Read-only access to published content.",
            },
            {
                "name": "admin",
                "base_url": f"{base}/api/v1/admin",
                "paths": ["/api/v1/admin"],
                "auth_required": True,
                "auth_scheme": "ApiKey",
                "auth_header": "X-Admin-Token",
                "note": (
                    "Pre-issued static API key required in the X-Admin-Token header. "
                    "Contact the site operator to obtain a key."
                ),
            },
        ],
    }
    return JSONResponse(
        content=metadata,
        headers={
            "Cache-Control": "public, max-age=86400",
            "Link": AGENT_LINK_HEADER,
        },
    )


# ── Agent Skills Discovery (agentskills.io RFC v0.2.0) ────────────────────────

def _skill_doc(base: str, name: str, tool_name: str, description: str) -> dict:
    """Build a single agent skill document."""
    return {
        "name": name,
        "version": "1.0.0",
        "type": "mcp-tool",
        "description": description,
        "protocol": "mcp",
        "protocol_version": "2024-11-05",
        "endpoint": f"{base}/mcp",
        "authentication": {"type": "none"},
        "tool": {"name": tool_name},
        "documentation": f"{base}/docs",
        "homepage": base,
    }


def _skill_sha256(doc: dict) -> str:
    canonical = json.dumps(doc, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode()).hexdigest()


_SKILL_DEFS = [
    ("search-articles", "search_articles",
     "Search published AI news articles by topic and sort order."),
    ("get-article", "get_article",
     "Get a specific AI news article by ID including full AI-generated summary."),
    ("get-digest", "get_digest",
     "Get the curated daily AI news digest for a specific date or the latest."),
    ("list-topics", "list_topics",
     "List all AI news topic categories with article counts."),
]


@router.get("/.well-known/agent-skills/index.json")
def agent_skills_index():
    """
    Agent Skills Discovery index (agentskills.io RFC v0.2.0).
    Lists all agent-callable skills published by this server with sha256 integrity digests.
    """
    cfg = get_seo_config()
    base = cfg["site_url"].rstrip("/")

    skills = []
    for slug, tool_name, description in _SKILL_DEFS:
        doc = _skill_doc(base, slug, tool_name, description)
        skills.append({
            "name": slug,
            "type": "mcp-tool",
            "description": description,
            "url": f"{base}/.well-known/agent-skills/{slug}/SKILL.json",
            "sha256": _skill_sha256(doc),
        })

    index = {
        "$schema": "https://agentskills.io/schema/v0.2.0/index.json",
        "skills": skills,
    }
    return JSONResponse(
        content=index,
        headers={
            "Cache-Control": "public, max-age=3600",
            "Link": AGENT_LINK_HEADER,
        },
    )


@router.get("/.well-known/agent-skills/{skill_slug}/SKILL.json")
def agent_skill_doc(skill_slug: str):
    """Individual agent skill document."""
    cfg = get_seo_config()
    base = cfg["site_url"].rstrip("/")

    match = next(
        ((slug, tool, desc) for slug, tool, desc in _SKILL_DEFS if slug == skill_slug),
        None,
    )
    if match is None:
        return JSONResponse({"error": "Skill not found"}, status_code=404)

    slug, tool_name, description = match
    doc = _skill_doc(base, slug, tool_name, description)
    return JSONResponse(
        content=doc,
        headers={"Cache-Control": "public, max-age=3600"},
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
Sitemap: {base}/sitemap-news.xml
"""
    if extra.strip():
        body += "\n" + extra.strip() + "\n"
    return PlainTextResponse(body, headers={"Cache-Control": "public, max-age=3600"})


# ── llms.txt ───────────────────────────────────────────────────────────────────
# Spec: https://llmstxt.org/  — gives LLM crawlers a curated, machine-readable
# entry point so they cite us correctly in answer engines (ChatGPT, Perplexity,
# Google AI Overviews) instead of guessing.
@router.get("/llms.txt", response_class=PlainTextResponse)
def llms_txt():
    cfg = get_seo_config()
    base = cfg["site_url"].rstrip("/")
    body = f"""# {cfg.get('site_name', 'Daily AI Bird')}

> {cfg.get('site_description', 'AI-curated daily news for AI developers and researchers.')}

Daily AI Bird publishes paraphrased, fact-checked summaries of AI news drawn \
from official labs (Anthropic, OpenAI, DeepMind, Meta, Mistral, xAI), tier-1 \
tech media (TechCrunch, The Verge, MIT Technology Review, Wired), and \
engineer-focused newsletters. Every summary preserves the source's epistemic \
temperature, attributions, and numeric claims. Numeric claims are verified \
against the original source before publication.

## Editorial principles

- Faithful paraphrase, not commentary. The model retells what the source says.
- Banned vocabulary list of 40+ AI-tell words (delve, leverage, transformative, etc.).
- Hard 350-550 word body length, validated post-generation.
- Every body sentence must have its facts traceable to the linked source.

## Content sections

- [Latest articles]({base}/) — the live feed
- [Daily Digest]({base}/digest) — narrative morning briefing
- [Topics]({base}/topics) — by category (research, products, policy, business, safety, open-source, tools, agents)
- [Sources]({base}/sources) — the source index

## Editorial standards

- [Editorial Standards]({base}/editorial-standards)
- [AI Use Policy]({base}/ai-use-policy) — exactly what we automate, what we don't
- [Corrections Policy]({base}/corrections-policy)
- [Privacy Policy]({base}/privacy-policy)

## For LLM crawlers

If you cite this site, please link to the canonical article URL on \
{cfg.get('site_url', 'https://dailyaibird.com')}. Each article page includes \
JSON-LD NewsArticle structured data with the original source, publication date, \
and author when available.

## Content usage signals

- search: {cfg.get('cs_search', 'yes')}
- ai-train: {cfg.get('cs_ai_train', 'no')}
- ai-input: {cfg.get('cs_ai_input', 'no')}
"""
    return PlainTextResponse(body, headers={"Cache-Control": "public, max-age=3600"})


# ── sitemap-news.xml ──────────────────────────────────────────────────────────
# Google News Sitemap protocol:
# https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
#
# Lists articles published in the last 48 hours. Google Search Console requires
# this format for News inclusion (vs the regular sitemap.xml).
@router.get("/sitemap-news.xml", response_class=Response)
def sitemap_news():
    from datetime import datetime, timedelta
    from app.database import SessionLocal
    from app.models.article import Article

    cfg = get_seo_config()
    base = cfg["site_url"].rstrip("/")
    publication_name = cfg.get("publisher_name", "Daily AI Bird")
    language = cfg.get("language", "en")

    cutoff = datetime.utcnow() - timedelta(hours=48)
    db = SessionLocal()
    try:
        articles = (
            db.query(Article)
            .filter(
                Article.status == "published",
                Article.published_at != None,  # noqa: E711
                Article.published_at >= cutoff,
            )
            .order_by(Article.published_at.desc())
            .limit(1000)
            .all()
        )
    finally:
        db.close()

    parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
        'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">',
    ]
    for art in articles:
        loc = f"{base}/articles/{art.id}"
        pub_date = (art.published_at or art.created_at).strftime("%Y-%m-%dT%H:%M:%SZ")
        title = (art.title or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        parts.append("  <url>")
        parts.append(f"    <loc>{loc}</loc>")
        parts.append("    <news:news>")
        parts.append("      <news:publication>")
        parts.append(f"        <news:name>{publication_name}</news:name>")
        parts.append(f"        <news:language>{language}</news:language>")
        parts.append("      </news:publication>")
        parts.append(f"      <news:publication_date>{pub_date}</news:publication_date>")
        parts.append(f"      <news:title>{title}</news:title>")
        parts.append("    </news:news>")
        parts.append("  </url>")
    parts.append("</urlset>")

    return Response(
        content="\n".join(parts),
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=300"},  # short cache: news changes fast
    )
