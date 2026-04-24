from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.article import Article
from app.schemas.article import ArticleOut, PaginatedArticles

router = APIRouter(prefix="/articles", tags=["articles"])


@router.get("", response_model=PaginatedArticles)
def list_articles(
    topic: Optional[str] = None,
    source_slug: Optional[str] = None,
    sort: str = Query("relevance", pattern="^(relevance|date)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    q = db.query(Article).filter(Article.status == "published")

    if topic:
        q = q.filter(Article.topic == topic)
    if source_slug:
        from app.models.source import Source
        source = db.query(Source).filter(Source.slug == source_slug).first()
        if source:
            q = q.filter(Article.source_id == source.id)

    if sort == "relevance":
        combined = (
            func.coalesce(Article.relevance_score, 0) * 0.6
            + func.coalesce(Article.impact_score, 0) * 0.4
        )
        q = q.order_by(combined.desc(), Article.published_at.desc())
    else:
        q = q.order_by(Article.published_at.desc())

    total = q.count()
    items = q.offset((page - 1) * per_page).limit(per_page).all()

    return PaginatedArticles(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        has_next=(page * per_page) < total,
    )


@router.get("/{article_id}", response_model=ArticleOut)
def get_article(article_id: int, db: Session = Depends(get_db)):
    article = (
        db.query(Article)
        .filter(Article.id == article_id, Article.status == "published")
        .first()
    )
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article
