"""Analytics routes — all data from real DB aggregations."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models.database import get_db
from models.models import User
from api.dependencies import get_current_user
from services.analytics_service import (
    get_summary, get_category_distribution, get_trends, get_location_distribution
)

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary")
def summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_summary(db, current_user.id)


@router.get("/categories")
def categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_category_distribution(db, current_user.id)


@router.get("/trends")
def trends(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_trends(db, current_user.id)


@router.get("/locations")
def locations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_location_distribution(db, current_user.id)
