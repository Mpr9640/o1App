# api/jobs.py
from datetime import datetime, date, time, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from db import get_db
from dependencies import get_current_user
from models1.jobs import JobApplication, JobStatus as SAJobStatus  # SQLAlchemy Enum
from schemas.jobs import JobApplicationIn, JobApplicationOut, JobApplicationUpdate

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

# ---------- LIST (supports /api/jobs and /api/jobs/) ----------
@router.get("", response_model=list[JobApplicationOut])
@router.get("/", response_model=list[JobApplicationOut])
def list_jobs(
    # filters (all optional)
    status: Optional[SAJobStatus] = Query(default=None, description="applied|interview|rejected|finalized"),
    start: Optional[date] = Query(default=None, description="YYYY-MM-DD (inclusive)"),
    end:   Optional[date] = Query(default=None, description="YYYY-MM-DD (inclusive)"),
    # paging
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    uid = user["user_id"]

    q = db.query(JobApplication).filter(JobApplication.user_id == uid)

    # status filter
    if status is not None:
        q = q.filter(JobApplication.status == status)

    # date range (inclusive)
    if start and end and start > end:
        raise HTTPException(status_code=400, detail="start date cannot be after end date")

    if start:
        start_dt = datetime.combine(start, time.min).replace(tzinfo=timezone.utc)
        q = q.filter(JobApplication.applied_at >= start_dt)

    if end:
        end_dt = datetime.combine(end, time.max).replace(tzinfo=timezone.utc)
        q = q.filter(JobApplication.applied_at <= end_dt)

    rows = (
        q.order_by(JobApplication.applied_at.desc())
         .offset(offset)
         .limit(limit)
         .all()
    )
    return rows

# ---------- CREATE (supports /api/jobs and /api/jobs/) ----------
@router.post("", response_model=JobApplicationOut, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=JobApplicationOut, status_code=status.HTTP_201_CREATED)
def create_job(
    app_in: JobApplicationIn,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """
    Creates a job application. If `url` is provided and a record with the same (user_id, url)
    already exists, we update that record with provided fields (upsert-by-url).
    """
    uid = user["user_id"]
    url_str = str(app_in.url) if app_in.url else None

    # If URL present, try upsert-by-(user_id,url)
    existing = None
    if url_str:
        existing = (
            db.query(JobApplication)
            .filter(JobApplication.user_id == uid, JobApplication.url == url_str)
            .one_or_none()
        )

    if existing:
        data = app_in.model_dump(exclude_unset=True)
        if "url" in data:
            data["url"] = url_str  # normalize AnyHttpUrl -> str
        # never allow these to be overwritten
        for k in ("id", "user_id", "created_at", "updated_at"):
            data.pop(k, None)
        for k, v in data.items():
            setattr(existing, k, v)
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    # Create new record
    data = app_in.model_dump(exclude_unset=True)
    data["user_id"] = uid
    data["url"] = url_str  # may be None

    rec = JobApplication(**data)
    db.add(rec)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # if race on same (user_id,url), return that instead of 500
        if url_str:
            already = (
                db.query(JobApplication)
                .filter(JobApplication.user_id == uid, JobApplication.url == url_str)
                .one_or_none()
            )
            if already:
                return already
        raise HTTPException(status_code=409, detail="Duplicate (user_id, url)")

    db.refresh(rec)
    return rec

# ---------- UPDATE ----------
@router.patch("/{job_id}", response_model=JobApplicationOut)
def update_job(
    job_id: int,
    app_in: JobApplicationUpdate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    uid = user["user_id"]
    rec = db.query(JobApplication).filter_by(id=job_id, user_id=uid).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Not found")

    data = app_in.model_dump(exclude_unset=True, exclude_none=True)
    if "url" in data and data["url"] is not None:
        data["url"] = str(data["url"])
    for k in ("id", "user_id", "created_at", "updated_at"):
        data.pop(k, None)

    for k, v in data.items():
        setattr(rec, k, v)

    db.commit()
    db.refresh(rec)
    return rec

# ---------- DELETE ----------
@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job(
    job_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    uid = user["user_id"]
    rec = db.query(JobApplication).filter_by(id=job_id, user_id=uid).first()
    if not rec:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(rec)
    db.commit()
    return  # 204
