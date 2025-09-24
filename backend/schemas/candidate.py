# candidate.py (schemas)
from pydantic import BaseModel, EmailStr
from datetime import date
from typing import Optional, List

class EducationIn(BaseModel):
    id: Optional[int] = None   # present => update; missing => create
    degree: Optional[str] = None
    major: Optional[str] = None
    school: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    currently_studying: Optional[bool] = False
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    cgpa: Optional[float] = None

class ExperienceIn(BaseModel):
    id: Optional[int] = None
    company_name: Optional[str] = None
    job_name: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    currently_working: Optional[bool] = False
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    job_duties: Optional[str] = None

class CandidateUpsert(BaseModel):
    # personal
    first_name: str
    middle_name: Optional[str] = None
    last_name: str
    full_name: Optional[str] = None
    email: EmailStr
    phone_number: str
    date_of_birth: date

    # residence
    residence_address: Optional[str] = None
    residence_city: Optional[str] = None
    residence_state: Optional[str] = None
    residence_zip_code: Optional[str] = None
    residence_country: Optional[str] = None

    # children
    educations: List[EducationIn] = []
    experiences: List[ExperienceIn] = []

    # other
    skills: Optional[str] = None
    job_titles: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    portfolio: Optional[str] = None
    resume: Optional[str] = None
    need_sponsorship: Optional[bool] = False
    veteran: Optional[bool] = False
    disability: Optional[bool] = False
    locations: Optional[str] = None
    race: Optional[str] = None
    gender: Optional[str] = None
    message_to_hiring_manager: Optional[str]
