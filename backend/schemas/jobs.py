from pydantic import BaseModel, AnyHttpUrl, ConfigDict, field_validator
from typing import Optional
from datetime import datetime
from enum import Enum

class JobStatus(str, Enum):
    applied = "applied"
    interview = "interview"
    rejected = "rejected"
    finalized = "finalized"

class JobApplicationIn(BaseModel):   # for POST
    title: str
    company: Optional[str] = None
    location: Optional[str] = None
    url: Optional[AnyHttpUrl] = None
    status: Optional[JobStatus] = JobStatus.applied
    notes: Optional[str] = None
    company_logo_url: Optional[str] = None
    source: Optional[str] = "manual"
    applied_at: Optional[datetime] = None
    model_config = ConfigDict(extra="ignore")

    @field_validator("company_logo_url")
    @classmethod
    def clamp_logo(cls, v):
        if v is None: return v
        v = str(v)
        return v if v.startswith("http://") or v.startswith("https://") else None

class JobApplicationUpdate(BaseModel):  # for PATCH
    title: Optional[str] = None
    company: Optional[str] = None
    location: Optional[str] = None
    url: Optional[AnyHttpUrl] = None
    status: Optional[JobStatus] = None
    notes: Optional[str] = None
    company_logo_url: Optional[str] = None
    source: Optional[str] = None
    applied_at: Optional[datetime] = None
    model_config = ConfigDict(extra="ignore")

class JobApplicationOut(JobApplicationIn):
    id: int
    model_config = ConfigDict(from_attributes=True)
