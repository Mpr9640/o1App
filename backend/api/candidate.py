from fastapi import APIRouter, Depends, HTTPException, Cookie
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from models import Candidate
from db import get_db
from dependencies import create_jwt_token, get_current_user
router = APIRouter()


class CandidateCreate(BaseModel):
    FirstName: str
    MiddleName: str
    LastName: str
    FullName: str
    Email: EmailStr
    PhoneNumber:int
    DateOfBirth:int
    Degree:str
    Major: str
    School: str
    StartDate: int
    EndDate: int
    CGPA: float
    Skills: str
    CompanyName: str
    JobName: str
    Description: str
    JobTittles: str
    UserId : int # Ensures you receive the user id from your auth layer

@router.post("/candidate")
def create_candidate(candidate: CandidateCreate, db: Session = Depends(get_db)):
    #Check if candidate exists, then update or create new record.
    db_candidate = db.query(Candidate).filter(Candidate.UserId==candidate.user_id).first()
    if db_candidate:
        #Update Candidate details
        db_candidate.FirstName = candidate.FirstName
        db_candidate.MiddleName = candidate.MiddleName
        db_candidate.LastName = candidate.LastName
        db_candidate.FullName = candidate.FirstName + " " + candidate.MiddleName + " " + candidate.LastName
        db_candidate.Email = candidate.Email
        db_candidate.PhoneNumber = candidate.PhoneNumber
        db_candidate.DateOfBirth = candidate.DateOfBirth
        db_candidate.Degree = candidate.Degree
        db_candidate.Major = candidate.Major
        db_candidate.School = candidate.School
        db_candidate.StartDate = candidate.StartDate
        db_candidate.EndDate = candidate.EndDate
        db_candidate.CGPA = candidate.CGPA
        db_candidate.Skills = candidate.Skills
        db_candidate.CompanyName = candidate.CompanyName
        db_candidate.JobName = candidate.JobName
        db_candidate.Description = candidate.Description
        db_candidate.JobTittles = candidate.JobTittles

    else:
        db_candidate = Candidate(
            FirstName = candidate.FirstName,
            MiddleName = candidate.MiddleName,
            LastName = candidate.LastName,
            FullName = candidate.FirstName + " " + candidate.MiddleName + " " + candidate.LastName,
            Email = candidate.Email,
            PhoneNumber = candidate.PhoneNumber,
            DateOfBirth = candidate.DateOfBirth,
            Degree = candidate.Degree,
            Major = candidate.Major,
            School = candidate.School,
            StartDate = candidate.StartDate,
            EndDate = candidate.EndDate,
            CGPA = candidate.CGPA,
            Skills = candidate.Skills,
            CompanyName = candidate.CompanyName,
            JobName = candidate.JobName,
            Description = candidate.Description,
            JobTittles = candidate.JobTittles,
            UserId = candidate.user_id
        )
        db.add(db_candidate)
    try:
        db.commit()
        db.refresh(db_candidate)
    except Exception as e:
        db.rollback()
        raise HTTPException(Status_code = 500, detail="Eror Saving Candidate date")
    return {"message": "Candidate data saved successfully","candidate": db_candidate.id}

