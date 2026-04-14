#!/usr/bin/env python3
"""
Full pipeline test: Scrape → Analyze → Enrich → Generate Digest with Gemma 4 31B

Usage:
  python test_full_pipeline.py
  python test_full_pipeline.py --source hackernews-ai
  python test_full_pipeline.py --limit 5

This tests:
  1. Scraping articles from news sources
  2. Call A: Quality check (detect spam, scams, low quality)
  3. Call B: Content enrichment (summary, topic, relevance score, etc.)
  4. Digest generation from processed articles
"""
import asyncio
import sys
import os
import json
from datetime import date, datetime, timedelta
from typing import Optional

# Add backend to path and load .env
backend_path = os.path.join(os.path.dirname(__file__), "backend")
sys.path.insert(0, backend_path)

# Change to backend directory so .env is found
os.chdir(backend_path)

from app.config import settings
from app.database import engine, SessionLocal
from app.models import Source, Article, DailyDigest, DigestArticle
from app.models.article import Article as ArticleModel
from app.models.source import Source as SourceModel
from app.database import Base
from app.scrapers.sources_config import SOURCES
from app.scrapers import get_scraper
from app.ai.processor import process_article
from app.ai.digest_generator import generate_digest


def setup_database():
    """Create tables if they don't exist."""
    import os
    
    # Create data directory if needed
    db_path = settings.DATABASE_URL.replace("sqlite:///./", "")
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
        print(f"📁 Created database directory: {db_dir}")
    
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created/verified\n")


def seed_sources(db):
    """Ensure all sources exist in the database."""
    for cfg in SOURCES:
        existing = db.query(SourceModel).filter(SourceModel.slug == cfg["slug"]).first()
        if not existing:
            source = SourceModel(
                name=cfg["name"],
                slug=cfg["slug"],
                url=cfg["url"],
                feed_url=cfg.get("feed_url"),
                scraper_type=cfg["scraper_type"],
                category=cfg["category"],
                scrape_config=json.dumps(cfg.get("scrape_config") or {}),
                is_active=True,
            )
            db.add(source)
    db.commit()


async def scrape_articles(source_config: dict, db) -> list[ArticleModel]:
    """Scrape articles from a single source."""
    source_slug = source_config["slug"]
    source = db.query(SourceModel).filter(SourceModel.slug == source_slug).first()
    
    if not source:
        print(f"❌ Source {source_slug} not found in database")
        return []
    
    print(f"\n📡 SCRAPING: {source_config['name']} ({source_config['scraper_type']})")
    print("=" * 70)
    
    try:
        scraper = get_scraper(source_config)
        scraped = await scraper.fetch_articles()
        print(f"✅ Fetched {len(scraped)} articles")
        
        # Save to database
        articles = []
        for scraped_article in scraped:
            existing = db.query(ArticleModel).filter(ArticleModel.url == scraped_article.url).first()
            if existing:
                continue
            
            article = ArticleModel(
                source_id=source.id,
                external_id=scraped_article.external_id,
                url=scraped_article.url,
                title=scraped_article.title,
                author=scraped_article.author,
                published_at=scraped_article.published_at,
                raw_content=scraped_article.raw_content,
                status="pending_ai",
            )
            db.add(article)
            articles.append(article)
        
        db.commit()
        print(f"✅ Saved {len(articles)} new articles to database\n")
        return articles
        
    except Exception as exc:
        print(f"❌ Scraping failed: {exc}\n")
        return []


def analyze_articles(articles: list[ArticleModel], db) -> dict:
    """Run Call A (quality check) + Call B (enrichment) on articles with Gemma 4 31B."""
    if not articles:
        print("⚠️  No articles to process")
        return {}
    
    print(f"\n🤖 PROCESSING: {len(articles)} articles with Gemma 4 31B")
    print("=" * 70)
    
    results = {
        "approved": [],
        "rejected": [],
        "errors": [],
    }
    
    for i, article in enumerate(articles, 1):
        source = article.source
        print(f"\n[{i}/{len(articles)}] Processing: {article.title[:60]}...")
        
        try:
            process_article(article, source.name, db)
            
            if article.status == "rejected_ai":
                reason = f"scam={article.is_scam}, quality={article.quality_score:.2f}"
                results["rejected"].append({
                    "title": article.title,
                    "reason": reason,
                })
                print(f"  ❌ REJECTED ({reason})")
            else:
                results["approved"].append({
                    "title": article.title,
                    "topic": article.topic,
                    "relevance": article.relevance_score,
                    "summary": article.summary[:100] + "..." if article.summary else "",
                })
                print(f"  ✅ APPROVED (topic={article.topic}, relevance={article.relevance_score:.2f})")
        
        except Exception as exc:
            print(f"  ❌ ERROR: {exc}")
            results["errors"].append({"title": article.title, "error": str(exc)})
    
    return results


def generate_daily_digest(db) -> Optional[dict]:
    """Generate digest from processed articles."""
    print(f"\n📰 GENERATING DIGEST for {date.today()}")
    print("=" * 70)
    
    try:
        digest = generate_digest(date.today(), db)
        
        if not digest:
            print("❌ Digest generation failed (no articles or error)")
            return None
        
        result = json.loads(digest.sections) if isinstance(digest.sections, str) else digest.sections
        
        print(f"✅ Digest generated successfully!")
        print(f"\n📌 Headline: {digest.headline}")
        print(f"📝 Intro: {digest.intro[:150]}...")
        print(f"📊 Articles: {digest.article_count}")
        print(f"🤖 Model: {digest.model_used}")
        
        if isinstance(result, list):
            for section in result[:2]:
                print(f"\n📌 Section: {section.get('section_title', 'Untitled')}")
                print(f"   {section.get('summary', '')[:100]}...")
        
        return {
            "headline": digest.headline,
            "intro": digest.intro,
            "article_count": digest.article_count,
            "model": digest.model_used,
        }
        
    except Exception as exc:
        print(f"❌ Digest generation failed: {exc}")
        import traceback
        traceback.print_exc()
        return None


async def main():
    # Parse args
    source_slug = None
    limit = 100
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "--source" and len(sys.argv) > 2:
            source_slug = sys.argv[2]
        elif sys.argv[1] == "--limit" and len(sys.argv) > 2:
            limit = int(sys.argv[2])
    
    print("\n" + "=" * 70)
    print("🚀 DAILY AI BIRD — FULL PIPELINE TEST")
    print("=" * 70)
    print(f"Model: Gemma 4 31B via OpenRouter")
    print(f"API Key: {'✅ Set' if settings.AI_API_KEY else '❌ NOT SET'}")
    
    # Setup
    setup_database()
    db = SessionLocal()
    seed_sources(db)
    
    # Filter sources
    sources_to_test = []
    for src in SOURCES:
        if source_slug and src["slug"] != source_slug:
            continue
        # Use HackerNews if no specific source is requested (most reliable)
        if not source_slug:
            if src["slug"] == "hackernews-ai":
                sources_to_test.append(src)
                break
        else:
            sources_to_test.append(src)
            break
    
    if not sources_to_test:
        print(f"❌ No sources found")
        return
    
    # Run pipeline
    all_articles = []
    for source_config in sources_to_test:
        articles = await scrape_articles(source_config, db)
        all_articles.extend(articles[:limit])
    
    if all_articles:
        results = analyze_articles(all_articles, db)
        digest = generate_daily_digest(db)
        
        # Summary
        print("\n" + "=" * 70)
        print("📊 PIPELINE SUMMARY")
        print("=" * 70)
        print(f"Scraped: {len(all_articles)}")
        print(f"Approved: {len(results['approved'])}")
        print(f"Rejected: {len(results['rejected'])}")
        print(f"Errors: {len(results['errors'])}")
        if digest:
            print(f"Digest: ✅ Generated")
        print("\n✅ Pipeline test complete!\n")
    else:
        print("⚠️  No articles scraped\n")
    
    db.close()


if __name__ == "__main__":
    asyncio.run(main())
