from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.article import Article

router = APIRouter(prefix="/topics", tags=["topics"])

# These slugs must match what the AI assigns in Call A (QUALITY_CHECK_PROMPT)
TOPICS = ["research", "products", "policy", "business", "safety", "open_source", "tools", "agents"]


@router.get("")
def list_topics(db: Session = Depends(get_db)):
    counts = dict(
        db.query(Article.topic, func.count(Article.id))
        .filter(Article.status == "published", Article.topic.isnot(None))
        .group_by(Article.topic)
        .all()
    )
    return [{"topic": t, "count": counts.get(t, 0)} for t in TOPICS]
