# candidate.py (router)
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
from typing import Optional

from db import get_db
from dependencies import get_current_user
from models import Candidate, Education, Experience

from schemas.candidate import CandidateUpsert  # if you split schemas; otherwise keep in same file
import os, uuid
import logging

logging.basicConfig(level=logging.INFO)
router = APIRouter()

UPLOAD_FOLDER = "uploads"
ALLOWED_EXT = {".pdf", ".doc", ".docx"}


def candidate_to_dict(c: Candidate):
    """Serialize Candidate + children to dict for JSON response."""
    return {
        "user_id": c.user_id,
        "first_name": c.first_name,
        "middle_name": c.middle_name,
        "last_name": c.last_name,
        "full_name": c.full_name,
        "email": c.email,
        "phone_number": c.phone_number,
        "date_of_birth": c.date_of_birth,
        "residence_address": c.residence_address,
        "residence_city": c.residence_city,
        "residence_state": c.residence_state,
        "residence_zip_code": c.residence_zip_code,
        "residence_country": c.residence_country,
        "skills": c.skills,
        "job_titles": c.job_titles,
        "linkedin": c.linkedin,
        "github": c.github,
        "portfolio": c.portfolio,
        "resume": c.resume,
        "need_sponsorship": c.need_sponsorship,
        "veteran": c.veteran,
        "disability": c.disability,
        "locations": c.locations,
        "race": c.race,
        "gender": c.gender,
        "message_to_hiring_manager": c.message_to_hiring_manager,
        "educations": [
            {
                "id": e.id,
                "degree": e.degree,
                "major": e.major,
                "school": e.school,
                "start_date": e.start_date,
                "end_date": e.end_date,
                "currently_studying": e.currently_studying,
                "address": e.address,
                "city": e.city,
                "state": e.state,
                "zip_code": e.zip_code,
                "country": e.country,
                "cgpa": float(e.cgpa) if e.cgpa is not None else None,
            }
            for e in c.educations
        ],
        "experiences": [
            {
                "id": x.id,
                "company_name": x.company_name,
                "job_name": x.job_name,
                "start_date": x.start_date,
                "end_date": x.end_date,
                "currently_working": x.currently_working,
                "address": x.address,
                "city": x.city,
                "state": x.state,
                "zip_code": x.zip_code,
                "country": x.country,
                "job_duties": x.job_duties,
            }
            for x in c.experiences
        ],
    }


@router.get("/candidate")
def get_candidate(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]
    cand = db.query(Candidate).filter(Candidate.user_id == user_id).first()
    if not cand:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate data not found")
    return candidate_to_dict(cand)


@router.post("/candidate")
def upsert_candidate(
    payload: CandidateUpsert,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["user_id"]

    # Basic candidate row
    cand = db.query(Candidate).filter(Candidate.user_id == user_id).first()
    creating = False
    if not cand:
        creating = True
        cand = Candidate(user_id=user_id)

    # Fill scalars (no children here)
    cand.first_name = payload.first_name
    cand.middle_name = payload.middle_name
    cand.last_name = payload.last_name
    cand.full_name = payload.full_name or f"{payload.first_name} {payload.middle_name or ''} {payload.last_name}".strip()
    cand.email = payload.email
    cand.phone_number = payload.phone_number
    cand.date_of_birth = payload.date_of_birth

    cand.residence_address = payload.residence_address
    cand.residence_city = payload.residence_city
    cand.residence_state = payload.residence_state
    cand.residence_zip_code = payload.residence_zip_code
    cand.residence_country = payload.residence_country

    cand.skills = payload.skills
    cand.job_titles = payload.job_titles
    cand.linkedin = payload.linkedin
    cand.github = payload.github
    cand.portfolio = payload.portfolio
    cand.resume = payload.resume
    cand.need_sponsorship = bool(payload.need_sponsorship)
    cand.veteran = bool(payload.veteran)
    cand.disability = bool(payload.disability)
    cand.locations = payload.locations
    cand.race = payload.race
    cand.gender = payload.gender
    cand.message_to_hiring_manager = payload.message_to_hiring_manager

    if creating:
        db.add(cand)
        db.flush()  # ensure it’s persistent before attaching children

    # ----- Sync children (upsert-by-id, delete-missing) -----
    # EDUCATIONS
    existing_edu = {e.id: e for e in cand.educations}
    seen_edu_ids = set()

    for item in payload.educations:
        if item.id and item.id in existing_edu:
            e = existing_edu[item.id]
            e.degree = item.degree
            e.major = item.major
            e.school = item.school
            e.start_date = item.start_date
            e.end_date = item.end_date
            e.currently_studying = bool(item.currently_studying)
            e.address = item.address
            e.city = item.city
            e.state = item.state
            e.zip_code = item.zip_code
            e.country = item.country
            e.cgpa = item.cgpa
            seen_edu_ids.add(item.id)
        else:
            e = Education(
                candidate_user_id=cand.user_id,
                degree=item.degree,
                major=item.major,
                school=item.school,
                start_date=item.start_date,
                end_date=item.end_date,
                currently_studying=bool(item.currently_studying),
                address=item.address,
                city=item.city,
                state=item.state,
                zip_code=item.zip_code,
                country=item.country,
                cgpa=item.cgpa,
            )
            db.add(e)
            db.flush()
            seen_edu_ids.add(e.id)

    for edu_id, edu in list(existing_edu.items()):
        if edu_id not in seen_edu_ids:
            db.delete(edu)

    # EXPERIENCES
    existing_exp = {x.id: x for x in cand.experiences}
    seen_exp_ids = set()

    for item in payload.experiences:
        if item.id and item.id in existing_exp:
            x = existing_exp[item.id]
            x.company_name = item.company_name
            x.job_name = item.job_name
            x.start_date = item.start_date
            x.end_date = item.end_date
            x.currently_working = bool(item.currently_working)
            x.address = item.address
            x.city = item.city
            x.state = item.state
            x.zip_code = item.zip_code
            x.country = item.country
            x.job_duties = item.job_duties
            seen_exp_ids.add(item.id)
        else:
            x = Experience(
                candidate_user_id=cand.user_id,
                company_name=item.company_name,
                job_name=item.job_name,
                start_date=item.start_date,
                end_date=item.end_date,
                currently_working=bool(item.currently_working),
                address=item.address,
                city=item.city,
                state=item.state,
                zip_code=item.zip_code,
                country=item.country,
                job_duties=item.job_duties,
            )
            db.add(x)
            db.flush()
            seen_exp_ids.add(x.id)

    for exp_id, exp in list(existing_exp.items()):
        if exp_id not in seen_exp_ids:
            db.delete(exp)

    # commit
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        logging.exception("Error saving candidate data")
        raise HTTPException(status_code=500, detail="Error saving candidate data")

    db.refresh(cand)
    return {"message": "Candidate saved", "candidate": candidate_to_dict(cand)}


@router.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    # safer unique filename (preserve extension)
    name, ext = os.path.splitext(file.filename or "")
    ext = ext.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_FOLDER, filename)

    with open(path, "wb") as f:
        f.write(await file.read())

    # Path your frontend already expects:
    return JSONResponse(content={"resume": f"/uploads/{filename}"})


@router.get("/uploads/{filename}")
async def serve_resume(filename: str):
    file_path = os.path.join(UPLOAD_FOLDER, filename)   # <-- fixed join
    if not os.path.exists(file_path):
        return JSONResponse(status_code=404, content={"message": "file not found"})
    # Let Starlette infer content-type
    return FileResponse(file_path, filename=filename)
