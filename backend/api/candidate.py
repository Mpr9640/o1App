from fastapi import APIRouter, Depends, HTTPException, Cookie, status,UploadFile,File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from models import Candidate
from db import get_db
import datetime
from datetime import date, datetime
from dependencies import create_jwt_token, get_current_user
from typing import Optional
import logging
import os
import uuid
from fastapi.responses import FileResponse

#configure logging
logging.basicConfig(level=logging.INFO)
router = APIRouter()

UPLOAD_FOLDER = 'uploads'

class CandidateCreate(BaseModel):
    first_name: str
    middle_name: Optional[str]
    last_name: str
    full_name: Optional[str] # backend will compute this if not provided
    email: EmailStr
    phone_number: str           # using string for phone numbers
    date_of_birth: date         # using date type for date fields
    residence_address:Optional[str]
    residence_city:Optional[str]
    residence_state:Optional[str]
    residence_zip_code:Optional[str]
    residence_country:Optional[str]
    degree: Optional[str]
    major: Optional[str]
    school: Optional[str]
    school_start_date:Optional[date]=None           # using date type for date fields
    school_end_date: Optional[date]=None             # using date type for date fields
    currently_studying:Optional[bool]=False
    school_address: Optional[str]
    school_city:Optional[str]
    school_state:Optional[str]
    school_zip_code:Optional[str]
    school_country:Optional[str]
    cgpa: Optional[float]
    company_name: Optional[str]
    job_name: Optional[str]
    job_start_date:Optional[date]=None
    job_end_date:Optional[date]=None
    currently_working:Optional[bool]=False
    job_address:Optional[str]
    job_city:Optional[str]
    job_state:Optional[str]
    job_zip_code:Optional[str]
    job_country:Optional[str]
    job_duties:Optional[str]
    skills:Optional[str]
    job_titles: Optional[str]            # corrected spelling to match the model
    linkedin:Optional[str]
    github:Optional[str]
    portfolio:Optional[str]
    resume:Optional[str] #store the path or URl
    need_sponsorship:Optional[bool]=False
    veteran: Optional[bool]=False
    disability:Optional[bool]=False
    locations:Optional[str]
    race:Optional[str]
    gender:Optional[str]
    user_id: Optional[int] = None             # ensures you receive the user id from your auth layer

@router.post("/candidate")
def create_candidate(candidate: CandidateCreate, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)): #current user is now dictionary.

    #manually convert date from str to obj.
    try:
        if isinstance (candidate.date_of_birth, str):
            candidate.date_of_birth = datetime.datetime.strptime(candidate.date_of_birth, "%Y-%m-%d").date()
        else:
            candidate.date_of_birth = candidate.date_of_birth
        if isinstance(candidate.job_start_date, str):
            candidate.job_start_date = datetime.datetime.strptime(candidate.job_start_date, "%Y-%m-%d").date()
        else:
            candidate.job_start_date = candidate.job_start_date
        if isinstance(candidate.job_end_date, str):
            candidate.job_end_date = datetime.datetime.strptime(candidate.job_end_date, "%Y-%m-%d").date()
        else:
            candidate.job_end_date = candidate.job_end_date
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
        db_candidate.date_of_birth = candidate.date_of_birth
        db_candidate.residence_address=candidate.residence_address
        db_candidate.residence_city = candidate.residence_city
        db_candidate.residence_state=candidate.residence_state
        db_candidate.residence_zip_code=candidate.residence_zip_code
        db_candidate.residence_country=candidate.residence_country
        db_candidate.degree = candidate.degree
        db_candidate.major = candidate.major
        db_candidate.school = candidate.school
        db_candidate.school_start_date = candidate.school_start_date
        db_candidate.school_end_date = candidate.school_end_date
        db_candidate.currently_studying = candidate.currently_studying
        db_candidate.school_address=candidate.school_address
        db_candidate.school_city = candidate.school_city
        db_candidate.school_state=candidate.school_state
        db_candidate.school_zip_code=candidate.school_zip_code
        db_candidate.school_country=candidate.school_country
        db_candidate.cgpa = candidate.cgpa
        db_candidate.company_name = candidate.company_name
        db_candidate.job_name = candidate.job_name
        db_candidate.job_start_date = candidate.job_start_date
        db_candidate.job_end_date = candidate.job_end_date
        db_candidate.currently_working = candidate.currently_working
        db_candidate.job_address=candidate.job_address
        db_candidate.job_city = candidate.job_city
        db_candidate.job_state=candidate.job_state
        db_candidate.job_zip_code=candidate.job_zip_code
        db_candidate.job_country=candidate.job_country
        db_candidate.job_duties=candidate.job_duties
        db_candidate.skills = candidate.skills
        db_candidate.job_titles = candidate.job_titles
        db_candidate.linkedin=candidate.linkedin
        db_candidate.github=candidate.github
        db_candidate.portfolio=candidate.portfolio
        db_candidate.resume=candidate.resume
        db_candidate.need_sponsorship=candidate.need_sponsorship
        db_candidate.veteran=candidate.veteran
        db_candidate.disability=candidate.disability
        db_candidate.locations=candidate.locations
        db_candidate.race=candidate.race
        db_candidate.gender=candidate.gender
        db_candidate.user_id = current_user["user_id"]
    else:
        db_candidate = Candidate(
            first_name=candidate.first_name,
            middle_name=candidate.middle_name,
            last_name=candidate.last_name,
            full_name=f"{candidate.first_name} {candidate.middle_name} {candidate.last_name}",
            email=candidate.email,
            phone_number=candidate.phone_number,
            date_of_birth=candidate.date_of_birth,
            residence_address=candidate.residence_address,
            residence_city = candidate.residence_city,
            residence_state=candidate.residence_state,
            residence_zip_code=candidate.residence_zip_code,
            residence_country=candidate.residence_country,
            degree=candidate.degree,
            major=candidate.major,
            school=candidate.school,
            school_start_date=candidate.school_start_date,
            school_end_date=candidate.school_end_date,
            currently_studying = candidate.currently_studying,
            school_address=candidate.school_address,
            school_city = candidate.school_city,
            school_state=candidate.school_state,
            school_zip_code=candidate.school_zip_code,
            school_country=candidate.school_country,
            cgpa=candidate.cgpa,
            company_name=candidate.company_name,
            job_name=candidate.job_name,
            job_city = candidate.job_city,
            job_state=candidate.job_state,
            job_zip_code=candidate.job_zip_code,
            job_country=candidate.job_country,
            job_duties=candidate.job_duties,
            skills = candidate.skills,
            job_titles=candidate.job_titles,
            linkedin=candidate.linkedin,
            github=candidate.github,
            portfolio=candidate.portfolio,
            resume=candidate.resume,
            need_sponsorship=candidate.need_sponsorship,
            veteran=candidate.veteran,
            disability=candidate.disability,
            locations=candidate.locations,
            race=candidate.race,
            gender=candidate.gender,
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
        data ={
            column.name: getattr(db_candidate,column.name)
            for column in Candidate.__table__.columns
        }
        return CandidateCreate(**data) 
        #return CandidateCreate(**db_candidate.__dict__)
    else:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate data not found")
@router.post("/upload-resume")
async def upload_resume(file:UploadFile=File(...)):
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    #filename = f"{uuid.uuid4()}_{file.filename}"
    filename = f"{file.filename}"
    filepath = os.path.join(UPLOAD_FOLDER,filename) # save physically here
    resume_path = f"/uploads/{filename}" #public URL or path:
    #filepath = os.path.join(UPLOAD_FOLDER,filename)
    with open(filepath,"wb") as f:
        content = await file.read()
        f.write(content)
    response = JSONResponse(content={"resume": resume_path})
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers['Access-Control-Allow-Credentials'] = 'true'

    return response
@router.get('/uploads/{filename}')

async def serve_resume(filename: str):
    file_path = os.path.join('uploads,filename')

    if not os.path.exists(file_path):
        return JSONResponse(status_code = 404, content={'message': 'file not found'})
    
    response = FileResponse(file_path, media_type = 'application/octet-stream')
    response.headers['Access-Control-Allow-Origin'] = "*"
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response


