"""
MCP (Model Context Protocol) server — SEP-1649 server card + JSON-RPC 2.0 endpoint.

Exposes Daily AI Bird's public news API as MCP tools so AI agents can
search, read, and summarise AI news without writing custom HTTP integration.

Transport: HTTP POST /mcp  (stateless, no SSE required for these read-only tools)
Auth: none — public read-only access only
Protocol version: 2024-11-05
"""
import json
import textwrap
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse, Response

from app.config_store import get_seo_config
from app.database import SessionLocal
from app.models.article import Article
from app.models.daily_digest import DailyDigest

router = APIRouter(tags=["mcp"])

MCP_PROTOCOL_VERSION = "2024-11-05"
_SERVER_INFO = {"name": "Daily AI Bird", "version": "1.0.0"}

_TOPICS = ["research", "products", "policy", "business", "safety", "open_source", "tools", "agents"]

# ── Tool schemas ───────────────────────────────────────────────────────────────

_TOOLS = [
    {
        "name": "search_articles",
        "description": (
            "Search and list published AI news articles from Daily AI Bird. "
            "Filter by topic and sort by relevance score or publication date. "
            "Returns titles, AI-generated summaries, source info, topic, scores, and article IDs."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "topic": {
                    "type": "string",
                    "description": "Filter by topic category.",
                    "enum": _TOPICS,
                },
                "sort": {
                    "type": "string",
                    "description": "Sort order: relevance (composite AI score) or date (newest first).",
                    "enum": ["relevance", "date"],
                    "default": "relevance",
                },
                "page": {
                    "type": "integer",
                    "description": "Page number (1-based).",
                    "default": 1,
                    "minimum": 1,
                },
                "per_page": {
                    "type": "integer",
                    "description": "Results per page (1–50).",
                    "default": 10,
                    "minimum": 1,
                    "maximum": 50,
                },
            },
        },
    },
    {
        "name": "get_article",
        "description": (
            "Get a single published article by its numeric ID. "
            "Returns full AI-generated summary, metadata, source link, topic, scores, and tags."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "integer",
                    "description": "Article ID (obtained from search_articles results).",
                },
            },
            "required": ["id"],
        },
    },
    {
        "name": "get_digest",
        "description": (
            "Get the curated daily AI news digest. "
            "Omit the date parameter to retrieve the latest published digest. "
            "Returns headline, intro summary, and topic sections with article lists."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "date": {
                    "type": "string",
                    "description": "Specific date in YYYY-MM-DD format. Omit for the latest digest.",
                    "pattern": r"^\d{4}-\d{2}-\d{2}$",
                },
            },
        },
    },
    {
        "name": "list_topics",
        "description": "List all article topic categories with article counts.",
        "inputSchema": {
            "type": "object",
            "properties": {},
        },
    },
]


# ── JSON-RPC helpers ───────────────────────────────────────────────────────────

def _ok(req_id: Any, result: Any) -> dict:
    return {"jsonrpc": "2.0", "id": req_id, "result": result}


def _err(req_id: Any, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


def _text(content: str) -> dict:
    return {"content": [{"type": "text", "text": content}]}


def _tool_err(message: str) -> dict:
    return {"content": [{"type": "text", "text": message}], "isError": True}


# ── Tool implementations ───────────────────────────────────────────────────────

def _do_search_articles(args: dict) -> dict:
    from sqlalchemy import func
    topic = args.get("topic")
    sort = args.get("sort", "relevance")
    page = max(1, int(args.get("page", 1)))
    per_page = max(1, min(50, int(args.get("per_page", 10))))

    db = SessionLocal()
    try:
        q = db.query(Article).filter(Article.status == "published")
        if topic:
            q = q.filter(Article.topic == topic)

        if sort == "relevance":
            momentum_boost = func.least(func.coalesce(Article.momentum_score, 1), 5) / 5.0
            score = (
                func.coalesce(Article.relevance_score, 0) * 0.35
                + func.coalesce(Article.impact_score, 0) * 0.25
                + func.coalesce(Article.curiosity_score, 0) * 0.25
                + momentum_boost * 0.15
            )
            q = q.order_by(score.desc(), Article.published_at.desc())
        else:
            q = q.order_by(Article.published_at.desc())

        total = q.count()
        articles = q.offset((page - 1) * per_page).limit(per_page).all()

        lines = [f"Found {total} article(s). Page {page} of {-(-total // per_page) or 1}.\n"]
        for a in articles:
            lines.append(
                f"ID: {a.id}\n"
                f"Title: {a.title}\n"
                f"Source: {a.source.name}\n"
                f"Topic: {a.topic or 'uncategorised'}\n"
                f"Published: {a.published_at.strftime('%Y-%m-%d') if a.published_at else 'unknown'}\n"
                f"Scores — Relevance: {a.relevance_score or 'n/a'}  "
                f"Impact: {a.impact_score or 'n/a'}  "
                f"Curiosity: {a.curiosity_score or 'n/a'}  "
                f"Momentum: {a.momentum_score}\n"
                + (f"Summary: {textwrap.shorten(a.summary or '', width=200, placeholder='…')}\n" if a.summary else "")
                + "---"
            )
        return _text("\n".join(lines))
    finally:
        db.close()


def _do_get_article(args: dict) -> dict:
    article_id = args.get("id")
    if not isinstance(article_id, int):
        return _tool_err("'id' must be an integer.")

    db = SessionLocal()
    try:
        a = db.query(Article).filter(
            Article.id == article_id, Article.status == "published"
        ).first()
        if not a:
            return _tool_err(f"Article {article_id} not found or not published.")

        cfg = get_seo_config()
        base = cfg["site_url"].rstrip("/")
        parts = [
            f"Title: {a.title}",
            f"Source: {a.source.name} ({a.source.url})",
            f"Original URL: {a.url}",
            f"Daily AI Bird URL: {base}/articles/{a.id}",
            f"Topic: {a.topic or 'uncategorised'}",
            f"Sentiment: {a.sentiment or 'n/a'}",
            f"Published: {a.published_at.strftime('%Y-%m-%d %H:%M UTC') if a.published_at else 'unknown'}",
            f"Added: {a.approved_at.strftime('%Y-%m-%d %H:%M UTC') if a.approved_at else 'unknown'}",
            f"Scores — Relevance: {a.relevance_score or 'n/a'}  "
            f"Impact: {a.impact_score or 'n/a'}  "
            f"Curiosity: {a.curiosity_score or 'n/a'}  "
            f"Momentum: {a.momentum_score}",
        ]
        if a.author:
            parts.insert(1, f"Author: {a.author}")
        if a.tags:
            parts.append(f"Tags: {', '.join(a.tags)}")
        if a.summary:
            parts.append(f"\nSummary (AI-generated, editor-reviewed):\n{a.summary}")
        parts.append(
            "\n⚠ This summary was generated by AI and reviewed by editors. "
            "Read the original article before citing or acting on this information."
        )
        return _text("\n".join(parts))
    finally:
        db.close()


def _do_get_digest(args: dict) -> dict:
    date_str = args.get("date")
    db = SessionLocal()
    try:
        q = db.query(DailyDigest).filter(DailyDigest.status == "published")
        if date_str:
            from datetime import date as _date
            try:
                d = _date.fromisoformat(date_str)
            except ValueError:
                return _tool_err(f"Invalid date format: '{date_str}'. Use YYYY-MM-DD.")
            digest = q.filter(DailyDigest.digest_date == d).first()
            if not digest:
                return _tool_err(f"No published digest found for {date_str}.")
        else:
            digest = q.order_by(DailyDigest.digest_date.desc()).first()
            if not digest:
                return _tool_err("No published digest available yet.")

        cfg = get_seo_config()
        base = cfg["site_url"].rstrip("/")
        lines = [
            f"Daily AI Bird Digest — {digest.digest_date.isoformat()}",
            f"URL: {base}/digest/{digest.digest_date.isoformat()}",
            f"Headline: {digest.headline}",
            f"Articles covered: {digest.article_count}",
            "",
            "Intro:",
            digest.intro or "(no intro)",
            "",
        ]
        if digest.sections:
            sections = digest.sections if isinstance(digest.sections, list) else []
            for section in sections:
                lines.append(f"── {section.get('heading', section.get('topic', 'Section'))} ──")
                for item in section.get("items", []):
                    lines.append(f"  • {item.get('title', '')}")
                    if item.get("one_liner"):
                        lines.append(f"    {item['one_liner']}")
                lines.append("")
        return _text("\n".join(lines))
    finally:
        db.close()


def _do_list_topics(_args: dict) -> dict:
    from sqlalchemy import func
    db = SessionLocal()
    try:
        rows = (
            db.query(Article.topic, func.count(Article.id))
            .filter(Article.status == "published", Article.topic.isnot(None))
            .group_by(Article.topic)
            .order_by(func.count(Article.id).desc())
            .all()
        )
        lines = ["Available topics:\n"]
        for topic, count in rows:
            lines.append(f"  {topic:<15} {count} articles")
        lines.append(
            "\nUse the 'topic' parameter in search_articles to filter by any of these."
        )
        return _text("\n".join(lines))
    finally:
        db.close()


_TOOL_HANDLERS = {
    "search_articles": _do_search_articles,
    "get_article": _do_get_article,
    "get_digest": _do_get_digest,
    "list_topics": _do_list_topics,
}


# ── MCP endpoint ───────────────────────────────────────────────────────────────

@router.post("/mcp")
async def mcp_endpoint(request: Request):
    """MCP JSON-RPC 2.0 endpoint. Handles initialize, tools/list, tools/call."""
    try:
        body = await request.json()
    except Exception:
        return JSONResponse(_err(None, -32700, "Parse error"), status_code=400)

    req_id = body.get("id")
    method = body.get("method", "")
    params = body.get("params") or {}

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    if method == "initialize":
        return JSONResponse(_ok(req_id, {
            "protocolVersion": MCP_PROTOCOL_VERSION,
            "capabilities": {"tools": {}},
            "serverInfo": _SERVER_INFO,
        }))

    if method == "notifications/initialized":
        # Notification — no id, no response body required
        return Response(status_code=204)

    # ── Tools ──────────────────────────────────────────────────────────────────

    if method == "tools/list":
        return JSONResponse(_ok(req_id, {"tools": _TOOLS}))

    if method == "tools/call":
        tool_name = params.get("name")
        arguments = params.get("arguments") or {}
        handler = _TOOL_HANDLERS.get(tool_name)
        if handler is None:
            return JSONResponse(
                _err(req_id, -32602, f"Unknown tool: '{tool_name}'"),
                status_code=400,
            )
        try:
            result = handler(arguments)
            return JSONResponse(_ok(req_id, result))
        except Exception as exc:
            return JSONResponse(_ok(req_id, _tool_err(f"Tool error: {exc}")))

    # ── Unknown method ─────────────────────────────────────────────────────────
    return JSONResponse(_err(req_id, -32601, f"Method not found: {method}"), status_code=404)


# ── MCP Server Card (SEP-1649) ─────────────────────────────────────────────────

@router.get("/.well-known/mcp/server-card.json")
def mcp_server_card():
    """
    SEP-1649 MCP Server Card — machine-readable description of this MCP server
    for agent auto-discovery.
    """
    cfg = get_seo_config()
    base = cfg["site_url"].rstrip("/")

    card = {
        # Top-level name for validators that check either location
        "name": "Daily AI Bird",
        "schemaVersion": "1.0",
        # serverInfo (camelCase) per SEP-1649 / PR #2127
        "serverInfo": {
            "name": "Daily AI Bird",
            "version": "1.0.0",
            "description": (
                "AI-assisted news intelligence for the AI ecosystem. "
                "Search, browse, and read the latest AI research, product, "
                "policy, and open-source news — curated and summarised daily."
            ),
            "homepage": base,
            "license": f"{base}/terms",
            "contact": "hello@dailyaibird.com",
        },
        "transport": {
            "type": "http",
            "url": f"{base}/mcp",
            "method": "POST",
        },
        "protocolVersion": MCP_PROTOCOL_VERSION,
        "capabilities": {
            "tools": True,
            "resources": False,
            "prompts": False,
            "sampling": False,
            "logging": False,
        },
        "authentication": {
            "type": "none",
            "note": "All tools access public read-only data. No credentials required.",
        },
        "tools": [
            {
                "name": t["name"],
                "description": t["description"],
            }
            for t in _TOOLS
        ],
        "rate_limits": {
            "note": "Reasonable use only. Contact hello@dailyaibird.com for high-volume access."
        },
    }
    return JSONResponse(
        content=card,
        headers={"Cache-Control": "public, max-age=3600"},
    )
