from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

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
