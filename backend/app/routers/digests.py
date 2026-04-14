from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.ai.client import stream_claude
from app.database import get_db
from app.models.daily_digest import DailyDigest
from app.schemas.digest import DigestOut

router = APIRouter(prefix="/digests", tags=["digests"])


@router.get("/today", response_model=DigestOut)
def get_today_digest(db: Session = Depends(get_db)):
    digest = (
        db.query(DailyDigest)
        .filter(DailyDigest.digest_date == date.today(), DailyDigest.status == "published")
        .first()
    )
    if not digest:
        raise HTTPException(status_code=404, detail="No published digest for today yet")
    return digest


@router.get("/{digest_date}", response_model=DigestOut)
def get_digest_by_date(digest_date: date, db: Session = Depends(get_db)):
    digest = (
        db.query(DailyDigest)
        .filter(DailyDigest.digest_date == digest_date, DailyDigest.status == "published")
        .first()
    )
    if not digest:
        raise HTTPException(status_code=404, detail=f"No published digest for {digest_date}")
    return digest


@router.post("/stream")
async def stream_digest_generation(prompt: str, max_tokens: int = 2000):
    """
    Stream digest generation token-by-token using Gemma 4 31B.
    
    Query params:
    - prompt: The prompt to send to the AI model
    - max_tokens: Maximum tokens to generate (default: 2000)
    
    Returns: Server-sent events stream with tokens
    """
    def event_generator():
        try:
            for token in stream_claude(prompt, max_tokens=max_tokens):
                yield f"data: {token}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: ERROR: {str(e)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
