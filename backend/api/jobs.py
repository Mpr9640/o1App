
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from db import get_db
from dependencies import get_current_user
from models1.jobs import JobApplication  # SQLAlchemy ORM model
from schemas.jobs import JobApplicationIn, JobApplicationOut, JobApplicationUpdate

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("", response_model=list[JobApplicationOut])
def list_jobs(
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    uid = user["user_id"]
    return (
        db.query(JobApplication)
        .filter(JobApplication.user_id == uid)
        .order_by(JobApplication.applied_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.post("", response_model=JobApplicationOut, status_code=status.HTTP_201_CREATED)
def create_job(
    app_in: JobApplicationIn,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    uid = user["user_id"]
    url_str = str(app_in.url) if app_in.url else None

    existing = None
    if url_str:
        existing = (
            db.query(JobApplication)
            .filter(JobApplication.user_id == uid, JobApplication.url == url_str)
            .one_or_none()
        )

    if existing:
        # Update only provided fields (exclude_unset honors PATCH-like behavior)
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
        db.refresh(existing)  # ✅ ORM instance
        return existing

    # Create path
    data = app_in.model_dump(exclude_unset=True)
    data["user_id"] = uid
    data["url"] = url_str

    rec = JobApplication(**data)
    db.add(rec)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # In case of a race: fetch the existing record and return it (or raise 409)
        already = (
            db.query(JobApplication)
            .filter(JobApplication.user_id == uid, JobApplication.url == url_str)
            .one_or_none()
        )
        if already:
            return already
        raise HTTPException(status_code=409, detail="Duplicate (user_id, url)")

    db.refresh(rec)  # ✅ ORM instance
    return rec


@router.patch("/{job_id}", response_model=JobApplicationOut)
def update_job(
    job_id: int,
    app_in: JobApplicationUpdate,  # <-- important
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
