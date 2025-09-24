# api/metrics.py
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Tuple
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from db import get_db
from dependencies import get_current_user
from models1.jobs import JobApplication

router = APIRouter(prefix="/api/jobs", tags=["jobs-metrics"])

STATUSES = ["applied", "interview", "rejected", "finalized"]

@router.get("/summary")
def jobs_summary(
    window_days: int = 90,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    uid = user["user_id"]
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=window_days)

    # Totals by status (all time)
    rows: List[Tuple[str, int]] = (
        db.query(JobApplication.status, func.count())
        .filter(JobApplication.user_id == uid)
        .group_by(JobApplication.status)
        .all()
    )
    by_status = {s or "applied": c for s, c in rows}
    total_all = sum(by_status.values())
    totals = {
        "all": total_all,
        "applied": by_status.get("applied", 0),
        "interview": by_status.get("interview", 0),
        "rejected": by_status.get("rejected", 0),
        "finalized": by_status.get("finalized", 0),
    }

    # Weekly series by status (last N days)
    weekly_rows = (
        db.query(
            func.date_trunc("week", JobApplication.applied_at).label("wk"),
            JobApplication.status,
            func.count().label("cnt"),
        )
        .filter(JobApplication.user_id == uid, JobApplication.applied_at >= since)
        .group_by("wk", JobApplication.status)
        .order_by("wk")
        .all()
    )
    # bucket into {week_start: {status: count}}
    bucket: Dict[str, Dict[str, int]] = {}
    for wk, status, cnt in weekly_rows:
        key = wk.date().isoformat()
        bucket.setdefault(key, {s: 0 for s in STATUSES})
        bucket[key][status or "applied"] = cnt

    # produce an array sorted by week
    weekly = []
    for week_start in sorted(bucket.keys()):
        item = {"week_start": week_start}
        item.update(bucket[week_start])
        weekly.append(item)

    return {
        "window_days": window_days,
        "totals": totals,
        "weekly": weekly,
    }
