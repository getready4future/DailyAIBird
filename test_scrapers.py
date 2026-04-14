#!/usr/bin/env python3
"""
Quick test script to run scrapers and see results.
Usage:
  python test_scrapers.py                    # Test all active sources
  python test_scrapers.py --source openai-blog   # Test specific source
  python test_scrapers.py --scraper rss          # Test specific scraper type

SETUP: pip install -r backend/requirements.txt
"""
import asyncio
import sys
import json
import os
from datetime import datetime

# Add backend to path and load .env
backend_path = os.path.join(os.path.dirname(__file__), "backend")
sys.path.insert(0, backend_path)
os.chdir(backend_path)

from app.scrapers.sources_config import SOURCES
from app.scrapers import get_scraper


async def test_scraper(source_config: dict):
    """Test a single scraper."""
    name = source_config["name"]
    slug = source_config["slug"]
    scraper_type = source_config["scraper_type"]
    
    print(f"\n{'='*70}")
    print(f"Testing: {name} ({slug})")
    print(f"Type: {scraper_type}")
    print(f"{'='*70}")
    
    try:
        scraper = get_scraper(source_config)
        articles = await scraper.fetch_articles()
        
        print(f"✅ Success! Fetched {len(articles)} articles\n")
        
        for i, article in enumerate(articles[:3], 1):
            print(f"--- Article {i} ---")
            print(f"Title: {article.title[:100]}")
            print(f"URL: {article.url[:80]}")
            if article.published_at:
                print(f"Published: {article.published_at}")
            print(f"Content: {article.raw_content[:150]}...")
            print()
            
        if len(articles) > 3:
            print(f"... and {len(articles) - 3} more articles")
            
    except Exception as e:
        print(f"❌ Error: {e}\n")
        import traceback
        traceback.print_exc()


async def main():
    # Parse CLI args
    filter_source = None
    filter_type = None
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "--source" and len(sys.argv) > 2:
            filter_source = sys.argv[2]
        elif sys.argv[1] == "--scraper" and len(sys.argv) > 2:
            filter_type = sys.argv[2]
    
    # Filter sources
    sources_to_test = []
    for src in SOURCES:
        if filter_source and src["slug"] != filter_source:
            continue
        if filter_type and src["scraper_type"] != filter_type:
            continue
        sources_to_test.append(src)
    
    if not sources_to_test:
        print("❌ No sources found matching filter")
        print(f"\nAvailable sources: {[s['slug'] for s in SOURCES]}")
        print(f"Available scrapers: rss, arxiv, hn, reddit, playwright")
        return
    
    print(f"Testing {len(sources_to_test)} source(s)...\n")
    
    # Run tests sequentially
    for source in sources_to_test:
        await test_scraper(source)
    
    print("\n" + "="*70)
    print("All tests complete!")
    print("="*70)


if __name__ == "__main__":
    asyncio.run(main())
