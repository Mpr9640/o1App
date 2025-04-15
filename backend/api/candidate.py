from fastapi import APIRouter, Depends, HTTPException, Cookie, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from models import Candidate
from db import get_db
import datetime
from datetime import date
from dependencies import create_jwt_token, get_current_user
from typing import Optional
import logging
#configure logging
logging.basicConfig(level=logging.INFO)
router = APIRouter()


class CandidateCreate(BaseModel):
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    full_name: Optional[str] # backend will compute this if not provided
    email: EmailStr
    phone_number: str           # using string for phone numbers
    date_of_birth: date         # using date type for date fields
    degree: str
    major: str
    school: str
    start_date: date           # using date type for date fields
    end_date: date             # using date type for date fields
    cgpa: float
    skills: str
    company_name: str
    job_name: str
    description: str
    job_titles: str            # corrected spelling to match the model
    user_id: Optional[int] = None             # ensures you receive the user id from your auth layer

@router.post("/candidate")
def create_candidate(candidate: CandidateCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)): #current user is now dictionary.
    #manually convert date from str to obj.
    try:
        if isinstance (candidate.date_of_birth, str):
            candidate_date_of_birth = datetime.datetime.strptime(candidate.date_of_birth, "%Y-%m-%d").date()
        else:
            candidate_date_of_birth = candidate.date_of_birth
        if isinstance(candidate.start_date, str):
            candidate_start_date = datetime.datetime.strptime(candidate.start_date, "%Y-%m-%d").date()
        else:
            candidate_start_date = candidate.start_date
        if isinstance(candidate.end_date, str):
            candidate_end_date = datetime.datetime.strptime(candidate.end_date, "%Y-%m-%d").date()
        else:
            candidate_end_date = candidate.end_date
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"invalid date format: {e}")

    if not candidate.full_name:
        candidate.full_name=f"{candidate.first_name} {candidate.middle_name} {candidate.last_name}".strip()
    # Check if candidate exists, then update or create new record.
    db_candidate = db.query(Candidate).filter(Candidate.user_id == current_user['user_id']).first()
    if db_candidate:
        # Update Candidate details
        db_candidate.first_name = candidate.first_name
        db_candidate.middle_name = candidate.middle_name
        db_candidate.last_name = candidate.last_name
        db_candidate.full_name = candidate.full_name
        db_candidate.email = candidate.email
        db_candidate.phone_number = candidate.phone_number
        db_candidate.date_of_birth = candidate_date_of_birth
        db_candidate.degree = candidate.degree
        db_candidate.major = candidate.major
        db_candidate.school = candidate.school
        db_candidate.start_date = candidate_start_date
        db_candidate.end_date = candidate_end_date
        db_candidate.cgpa = candidate.cgpa
        db_candidate.skills = candidate.skills
        db_candidate.company_name = candidate.company_name
        db_candidate.job_name = candidate.job_name
        db_candidate.description = candidate.description
        db_candidate.job_titles = candidate.job_titles
        db_candidate.user_id = current_user["user_id"]
    else:
        db_candidate = Candidate(
            first_name=candidate.first_name,
            middle_name=candidate.middle_name,
            last_name=candidate.last_name,
            full_name=f"{candidate.first_name} {candidate.middle_name} {candidate.last_name}",
            email=candidate.email,
            phone_number=candidate.phone_number,
            date_of_birth=candidate_date_of_birth,
            degree=candidate.degree,
            major=candidate.major,
            school=candidate.school,
            start_date=candidate_start_date,
            end_date=candidate_end_date,
            cgpa=candidate.cgpa,
            skills=candidate.skills,
            company_name=candidate.company_name,
            job_name=candidate.job_name,
            description=candidate.description,
            job_titles=candidate.job_titles,
            user_id=current_user['user_id'] #set from token payload
        )
        db.add(db_candidate)
    try:
        db.commit()
        db.refresh(db_candidate)
        return {"message": "Candidate data saved successfully","candidate": db_candidate.user_id}
    except Exception as e:
        db.rollback()
        logging.error(f"Error saving candidate data: {e}", exc_info=True) #exc_info=True argumnet will include the full traceback of the exception log.
        raise HTTPException(status_code = 500, detail="Eror Saving Candidate data")
        
@router.get("/candidate")
def get_candidate(db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
    user_id = current_user['user_id']
    logging.info(f'Retrieving candidate data for user_id: {user_id}')
    db_candidate = db.query(Candidate).filter(Candidate.user_id == current_user['user_id']).first()
    if db_candidate:
        logging.info(f'candidate data found')
        return CandidateCreate(**db_candidate.__dict__)  ##serialize with Pydantic model
        return db_candidate
    else:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate data not found")

