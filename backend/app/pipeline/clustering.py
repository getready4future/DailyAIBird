"""
Story clustering: group pending_ai articles that cover the same news story.
The best article in each cluster keeps its status; others are marked 'clustered'.
The primary article gets momentum_score = cluster size.
"""
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.article import Article
from app.pipeline.deduplicator import titles_are_similar

logger = logging.getLogger(__name__)

CLUSTER_THRESHOLD = 0.55  # looser than dedup — same story, different angle


def _source_priority(article: Article) -> int:
    """Lower = higher priority (prefer authoritative primary sources)."""
    scraper_type = article.source.scraper_type if article.source else "rss"
    # Primary sources beat aggregators
    if scraper_type in ("rss", "playwright"):
        return 0
    if scraper_type in ("hn", "reddit", "arxiv"):
        return 2
    if scraper_type == "gnews":
        return 1
    return 1


def cluster_pending_articles(db: Session) -> int:
    """
    Group pending_ai articles into story clusters.
    Returns the number of articles merged (marked 'clustered').
    """
    pending = (
        db.query(Article)
        .filter(Article.status == "pending_ai", Article.ai_processed.is_(False))
        .order_by(Article.created_at.asc())
        .all()
    )
    if len(pending) < 2:
        return 0

    # Union-find
    parent = list(range(len(pending)))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(pending)):
        for j in range(i + 1, len(pending)):
            if titles_are_similar(pending[i].title, pending[j].title, CLUSTER_THRESHOLD):
                ri, rj = find(i), find(j)
                if ri != rj:
                    parent[ri] = rj

    # Group by cluster root
    clusters: dict[int, list[int]] = {}
    for i in range(len(pending)):
        root = find(i)
        clusters.setdefault(root, []).append(i)

    merged = 0
    for indices in clusters.values():
        if len(indices) < 2:
            continue

        articles = [pending[i] for i in indices]

        # Pick the best representative: prefer primary sources, then earliest published
        best = min(articles, key=lambda a: (
            _source_priority(a),
            a.published_at or datetime.utcnow(),
        ))

        cluster_size = len(articles)
        best.momentum_score = cluster_size

        source_names = [a.source.name for a in articles if a.source]
        for article in articles:
            if article.id != best.id:
                article.status = "clustered"
                article.ai_processed = True
                article.ai_processed_at = datetime.utcnow()
                article.rejection_reason = f"Clustered under article {best.id} (momentum={cluster_size})"
                merged += 1

        from app.ai import progress
        progress.emit(
            best.title,
            kind="clustered",
            cluster_size=cluster_size,
            sources=source_names,
            primary_source=best.source.name if best.source else "",
        )

        logger.info(
            "Cluster of %d articles → primary: %s (sources: %s)",
            cluster_size,
            best.title[:60],
            ", ".join(source_names),
        )

    if merged:
        db.commit()
        logger.info("Story clustering: %d articles merged into clusters", merged)

    return merged
