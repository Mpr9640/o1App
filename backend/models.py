# models.py
from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean, ForeignKey, Numeric, Date, Text
)
from sqlalchemy.orm import relationship
from db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    email_token = Column(String, nullable=True)
    email_token_expiration = Column(DateTime(timezone=True), nullable=True)
    password = Column(String, nullable=False)
    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)
    confirm_token = Column(String, nullable=True)
    confirm_token_expires = Column(DateTime(timezone=True), nullable=True)
    is_confirmed = Column(Boolean, default=False)


class Candidate(Base):
    __tablename__ = "candidates"

    # PK is user_id (as you had)
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True, index=True)

    # Personal
    first_name = Column(String, nullable=False)
    middle_name = Column(String, nullable=True)
    last_name = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    email = Column(String, nullable=False)
    phone_number = Column(String(14), nullable=False)
    date_of_birth = Column(Date, nullable=False)

    # Residence
    residence_address = Column(String, nullable=True)
    residence_city = Column(String, nullable=True)
    residence_state = Column(String, nullable=True)
    residence_zip_code = Column(String, nullable=True)
    residence_country = Column(String, nullable=True)

    # Other
    skills = Column(Text, nullable=True)
    job_titles = Column(Text, nullable=True)
    linkedin = Column(String, nullable=True)
    github = Column(String, nullable=True)
    portfolio = Column(String, nullable=True)
    resume = Column(String, nullable=True)
    need_sponsorship = Column(Boolean, nullable=True)
    veteran = Column(Boolean, nullable=True)
    disability = Column(Boolean, nullable=True)
    locations = Column(Text, nullable=True)
    race = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    message_to_hiring_manager = Column(String, nullable=True)

    user = relationship("User")

    # NEW: dynamic children
    educations = relationship(
        "Education",
        back_populates="candidate",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )
    experiences = relationship(
        "Experience",
        back_populates="candidate",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )


class Education(Base):
    __tablename__ = "educations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    candidate_user_id = Column(Integer, ForeignKey("candidates.user_id", ondelete="CASCADE"), index=True)

    degree = Column(String, nullable=True)
    major = Column(String, nullable=True)
    school = Column(String, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    currently_studying = Column(Boolean, nullable=True)

    address = Column(Text, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)
    country = Column(String, nullable=True)
    cgpa = Column(Numeric(4, 2), nullable=True)

    candidate = relationship("Candidate", back_populates="educations")


class Experience(Base):
    __tablename__ = "experiences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    candidate_user_id = Column(Integer, ForeignKey("candidates.user_id", ondelete="CASCADE"), index=True)

    company_name = Column(String, nullable=True)
    job_name = Column(String, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    currently_working = Column(Boolean, nullable=True)

    address = Column(Text, nullable=True)
    city = Column(String, nullable=True)
    state = Column(String, nullable=True)
    zip_code = Column(String, nullable=True)
    country = Column(String, nullable=True)
    job_duties = Column(Text, nullable=True)

    candidate = relationship("Candidate", back_populates="experiences")
