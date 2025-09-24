from sqlalchemy import Column, Integer, String, Text, DateTime, Enum as SAEnum, func, UniqueConstraint,ForeignKey
from db import Base
import enum

class JobStatus(str, enum.Enum):
    applied = "applied"
    interview = "interview"
    rejected = "rejected"
    finalized = "finalized"

class JobApplication(Base):
    __tablename__ = "job_applications"
    __table_args__ = (
        UniqueConstraint("user_id", "url", name="uq_user_url"),
    )

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"),index=True, nullable=False)

    title = Column(String(255), nullable=False)
    company = Column(String(255))
    location = Column(String(255))
    url = Column(String(1024))  # store as string
    status = Column(SAEnum(JobStatus, name="job_status"), default=JobStatus.applied, nullable=False)
    notes = Column(Text)
    source = Column(String(50), default="manual")
    company_logo_url = Column(String(1024))
    applied_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
