# Daily AI Bird

AI-curated daily news for developers and researchers. Fresh AI updates every morning, analyzed for quality, filtered for scams, and published only after human approval.

## How It Works

```
Scrape (16 sources) → AI scam check → AI enrichment → Human review → Publish
                                                           ↓
                                              Daily digest → Human review → Publish
```

1. **Scrape** — 16 sources scraped daily (AI blogs, tech news, arXiv, HN, Reddit)
2. **Call A** — Claude checks each article for scam, clickbait, and quality score
3. **Call B** — Claude summarizes, categorizes, and scores articles that pass
4. **Human Review** — Admin reviews the moderation queue and approves/rejects
5. **Daily Digest** — Claude generates a curated briefing from published articles
6. **Digest Review** — Admin approves the digest before it's published

Nothing reaches users without human sign-off.

## Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy, SQLite, APScheduler
- **AI**: Claude (claude-sonnet-4-6) via Anthropic SDK
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Scraping**: feedparser (RSS), httpx + BeautifulSoup4, Playwright, arXiv API, HN Algolia API, Reddit JSON API

## Quick Start

### With Docker Compose (recommended)

```bash
cp .env.example .env
# Edit .env: set ANTHROPIC_API_KEY and ADMIN_SECRET

docker compose up
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/v1
- API docs: http://localhost:8000/docs

### Without Docker

**Backend:**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
playwright install chromium

cp ../.env.example .env  # set ANTHROPIC_API_KEY
mkdir -p data

uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## News Sources

| Category | Sources |
|---|---|
| AI Blogs | OpenAI, Anthropic, Google DeepMind, HuggingFace, Meta AI |
| Tech News | TechCrunch AI, The Verge AI, VentureBeat AI, Wired AI |
| Research | arXiv cs.AI, arXiv cs.LG, arXiv cs.CL, Papers With Code |
| Social | Hacker News AI, Reddit r/MachineLearning, Reddit r/artificial |

## Admin Interface

Visit `/admin` to access the moderation queue.

```
GET  /api/v1/admin/queue                   # pending articles
POST /api/v1/admin/articles/{id}/approve   # publish article
POST /api/v1/admin/articles/{id}/reject    # reject with reason
GET  /api/v1/admin/digests/pending         # pending digests
POST /api/v1/admin/digests/{id}/approve    # publish digest
POST /api/v1/admin/trigger-scrape          # manual scrape trigger
POST /api/v1/admin/trigger-digest          # manual digest generation
```

All admin routes require `X-Admin-Token: <ADMIN_SECRET>` header.

## Environment Variables

See `.env.example` for all options. Required:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `ADMIN_SECRET` | Admin token for moderation API |

## Schedule

| Time (UTC) | Job |
|---|---|
| 06:00 | Scrape all sources |
| 07:15 | Generate daily digest |
| 03:00 | Clean up articles older than 30 days |

## API Reference

```
GET  /api/v1/articles              # paginated feed (published only)
GET  /api/v1/articles/{id}         # single article
GET  /api/v1/digests/today         # today's briefing
GET  /api/v1/digests/{date}        # historical digest
GET  /api/v1/topics                # topic list with counts
GET  /api/v1/sources               # active sources
GET  /api/v1/health                # health check
```
