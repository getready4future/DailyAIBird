# Changelog

All notable changes to Daily AI Bird are documented here.

---

## [Unreleased] — 2026-04-26

### Agent-Readiness & Discovery

- **RFC 8288 Link headers** — every response now carries `Link:` headers pointing to the API catalog, OAuth metadata, MCP server card, agent skills index, sitemap, and documentation, enabling automated agent discovery chains
- **RFC 9727 API Catalog** — `/.well-known/api-catalog` returns a proper RFC 9264 `application/linkset+json` document cross-referencing all machine-readable endpoints
- **RFC 8414 OAuth AS Metadata** — `/.well-known/oauth-authorization-server` documents the API access model: public read (no auth) and admin write (static `X-Admin-Token`), with no implicit OAuth promises
- **RFC 9728 OAuth Protected Resource Metadata** — `/.well-known/oauth-protected-resource` points agents to the correct authorization server and documents access tiers
- **SEP-1649 MCP Server Card** — `/.well-known/mcp/server-card.json` published with correct camelCase field names (`serverInfo`, `schemaVersion`, `protocolVersion`) and full transport, capabilities, and authentication declaration
- **MCP JSON-RPC 2.0 endpoint** — `POST /mcp` supports `initialize`, `notifications/initialized`, `tools/list`, and `tools/call` with four tools: `search_articles`, `get_article`, `get_digest`, `list_topics`
- **Agent Skills Discovery (agentskills.io RFC v0.2.0)** — `/.well-known/agent-skills/index.json` publishes a signed index of all MCP tools; individual skill docs at `/.well-known/agent-skills/{slug}/SKILL.json` include JSON Schema and SHA-256 integrity hashes
- **WebMCP browser API** — `navigator.modelContext.provideContext` called on page load with all four tools; agents running in the browser can discover and call site actions without a network round-trip to the tool registry
- **Markdown-for-Agents** — responses to `Accept: text/markdown` requests return `Content-Type: text/markdown` with rendered content for `/articles/:id`, `/digest/:date`, `/topics`, and the homepage; `x-markdown-tokens` header provides a BPE token estimate
- **Content-Signal directives** — `robots.txt` includes `Content-Signal: search=yes, ai-train=no, ai-input=no` (draft-romm-aipref-contentsignals); configurable per-site via Admin → SEO
- **Bot rendering** — server-side meta tag injection for crawlers and scrapers; BOT_PATTERNS regex detects 20+ known bot user-agents and serves enriched HTML with Open Graph, Twitter Card, and JSON-LD metadata

### Content Pipeline

- **Topics bug fixed** — the topics router was serving a Title Case list (`"Research"`, `"Open Source"`) that never matched the lowercase slugs the AI assigns (`research`, `open_source`). All topic counts were showing 0. Fixed by aligning backend TOPICS, frontend filters, TopicBadge, and the Topics page to the AI's actual output vocabulary
- **TopicBadge** now exports a `topicLabel()` helper that converts `open_source` → `"Open Source"` etc. for display; all consumer-facing labels use this function
- **4× daily scraping** — scheduler changed from a single daily scrape (6 AM UTC) to every 6 hours (00:00, 06:00, 12:00, 18:00 UTC), keeping the feed fresh throughout the day without duplicating effort (coalesce enabled)
- **AI prompts upgraded** — QUALITY_CHECK_PROMPT and ENRICH_PROMPT rewritten with full editorial guidance: reader persona definitions, explicit publish/skip criteria, per-score rubrics (0–5 with named examples), headline/body rules, and E-E-A-T compliance notes. DIGEST_PROMPT expanded with narrative intro guidance and per-field rules. Combined word count increased from ~350 to ~1,200 words

### Security

- **Removed `GET /api/v1/admin/debug-auth` endpoint** — this unauthenticated endpoint revealed admin existence, tested three hardcoded passwords (including a developer name), and exposed partial secrets. Removed entirely
- **Turkish SSE messages translated to English** — all pipeline progress events emitted via SSE (scrape start, fetch done, skip reasons, AI batch start, cross-source dedup, cluster, error) are now in English, removing the frontend dependency on Turkish string parsing

### Performance

- **N+1 queries eliminated** — `joinedload(Article.source)` added to article list, article detail, moderation queue, and scrape runs endpoints; eliminates a per-row DB round-trip when serialising `source` in `ArticleOut`
- **Source ID index** — `ix_articles_source_id` index added to the `articles` table for faster FK joins
- **Connection pooling** — non-SQLite deployments now get `pool_size=10, max_overflow=20` on the SQLAlchemy engine
- **Async digest scheduler** — `_run_digest` converted to `async def` using `asyncio.to_thread` so the digest pipeline doesn't block the event loop

### SEO

- **react-helmet-async** — `HelmetProvider` added at app root; per-route `<Helmet>` blocks on Home, ArticleDetail, DailyDigest, and Topics
- **ArticleDetail JSON-LD** — `NewsArticle` and `BreadcrumbList` structured data injected client-side
- **Topic-aware titles** — Home page title updates to `"{Topic} AI News — Daily AI Bird"` when a topic filter is active
- **Pagination rel links** — `<link rel="prev">` / `<link rel="next">` injected via Helmet on paginated home pages
- **Semantic pagination** — Previous/Next pagination buttons replaced with `<a href>` elements; click handlers prevent full-page navigation while keeping URLs crawlable

### Accessibility

- **Image alt text** — all three ArticleCard variants (hero, large, default) and the ArticleDetail hero image now carry `alt={article.title}`
- **Breadcrumb text size** — bumped from `text-xs` to `text-sm` for legibility

### Mobile

- **Hamburger menu** — Header now renders a collapsed nav on mobile with an animated three-line toggle; desktop nav hidden below `md:` breakpoint
- **Mobile dropdown** — full-width slide-in nav with active-route highlighting; closes on link tap

### WCAG Contrast

- **TopicBadge** — policy, business, and safety badge text darkened from `*-800` to `*-900` for WCAG AA compliance
- **Footer bottom bar** — `text-gray-400` → `text-gray-500` on `bg-gray-50`
- **Nav links** — `text-gray-400` → `text-gray-300` for better contrast on `bg-gray-950` header

### Security

- **CORS** — `allow_methods: "*"` restricted to explicit verb list; `expose_headers: "*"` narrowed to `["Content-Type", "X-Admin-Token"]`
- **SQLite production warning** — startup logs a warning when SQLite is detected so operators know to switch to PostgreSQL before deploying to Railway
- **Axios timeout** — both `api` and `adminApi` clients now have a 30-second timeout, preventing hung requests from blocking the UI indefinitely

### Copy & UX

- **Home subheadline** — updated to "Surfaced, summarised, and scored by AI · reviewed by humans"
- **Sentiment badge** — `capitalize` applied; `cursor-help` + `title` tooltip explaining AI assessment
- **Momentum badge** — `cursor-help` + tooltip explaining trending signal
- **Report an error link** — mailto link at the bottom of every ArticleDetail page pre-fills subject and article URL
- **AIDisclosure** — compact label renamed from "AI-Assisted Summary" to "AI-Assisted Content" for consistency with the expanded view

### Bug Fixes

- **Security — password bypass removed** — a code path allowed the plain `ADMIN_PASSWORD` env var to bypass bcrypt hash verification. Removed.
- **Security — exception detail leak** — `delete_source` endpoint was re-raising raw exception messages to the client. Now logs internally and returns a generic 500 message.
- **Admin login — English error messages** — all Turkish error strings replaced with English equivalents
- **Newsletter — fake success removed** — the signup form was calling `setSubmitted(true)` without a backend request, showing "You're on the list!" falsely. Replaced with an honest coming-soon notice.
- **Progress messages** — `emit("Scraping tamamlandı!")` Turkish string replaced with English

### Editorial & Trust

- **Policy pages** — About, Editorial Standards, AI Use Policy, Privacy Policy, Terms of Use, Advertising Policy, Corrections Policy
- **AI Disclosure banner** — expandable amber banner on article detail pages linking to the AI Use Policy
- **Newsletter signup stub** — form UI component ready for backend wiring
- **Footer redesign** — 4-column grid with Discover, Company, and Legal link groups; trust badges (AI-Assisted, Editor-Reviewed); AI disclosure link in bottom bar
- **Organization + WebSite JSON-LD** — `index.html` includes a `@graph` schema with `SearchAction` for Google
- **Dark header** — sticky `bg-gray-950` header with white logo and nav links

### Frontend UI

- **ArticleCard variants** — three card sizes: `hero` (full-bleed image with gradient overlay, 2-column span), `large` (prominent image + 2-line summary), `default` (compact list card)
- **Editorial grid layout** — ArticleGrid now renders: first article as hero (spans 2 of 3 columns), articles 2–3 as large cards in a sidebar stack, remaining articles in a 3-column grid below
- **ArticleDetail improvements** — full-width hero image, `text-3xl` title, `text-lg leading-relaxed` body paragraphs, dual timestamp (source date + added date), Read Original CTA block, tags, and newsletter signup
- **White background** — layout switched from `bg-gray-50` to `bg-white` for a cleaner editorial feel

---

## Earlier

See git log for the full history prior to the agent-readiness work.
