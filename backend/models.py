from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Numeric, Date
from db import Base
import datetime
from datetime import datetime
from sqlalchemy.orm import relationship

class User(Base):  # base is typically a declarative base class in SQLALchemy used to define models that helps to map to databse tables.
    __tablename__="users"

    id=Column(Integer, primary_key=True, index=True) # primary_key means unique Identifier in a row.an it makes sures the values is not null and each column in his row is designated as primary key.
    email = Column(String, unique=True, index=True, nullable=False) # unique to make no other row will have the same value.
    email_token = Column(String, nullable=True)
    email_token_expiration = Column(DateTime(timezone=True), nullable=True) #DateTime used as a data type for storing date and time values.
    password = Column(String, nullable=False)
    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable= True)
    confirm_token = Column(String, nullable = True)
    confirm_token_expires = Column(DateTime(timezone=True), nullable=True)
    is_confirmed = Column(Boolean, default=False )
class Candidate(Base):
    __tablename__ = "candidates"
    
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True, index=True)
    first_name = Column(String, nullable=False)
    middle_name = Column(String, nullable=True)
    last_name = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    email = Column(String, nullable=False)
    phone_number = Column(String(14), nullable=False)
    date_of_birth = Column(Date, nullable=False)
    residence_address=Column(String, nullable=True)
    residence_city=Column(String, nullable=True)
    residence_state=Column(String, nullable=True)
    residence_zip_code=Column(String, nullable=True)
    residence_country=Column(String, nullable=True)
    degree = Column(String, nullable=True)
    major = Column(String, nullable=True)
    school = Column(String, nullable=True)
    school_start_date = Column(Date, nullable=True)
    school_end_date = Column(Date, nullable=True)
    currently_studying=Column(Boolean,nullable=True)
    school_address=Column(String, nullable=True)
    school_city=Column(String, nullable=True)
    school_state=Column(String, nullable=True)
    school_zip_code=Column(String, nullable=True)
    school_country=Column(String, nullable=True)
    cgpa = Column(Numeric(3, 2), nullable=True)
    company_name = Column(String, nullable=True)
    job_name = Column(String, nullable=True)
    job_start_date=Column(Date, nullable=True)
    job_end_date=Column(Date, nullable=True)
    currently_working=Column(Boolean,nullable=True)
    job_address=Column(String, nullable=True)
    job_city=Column(String, nullable=True)
    job_state=Column(String, nullable=True)
    job_zip_code=Column(String, nullable=True)
    job_country=Column(String, nullable=True)
    job_duties=Column(String, nullable=True)
    skills = Column(String, nullable=True)
    job_titles = Column(String, nullable=True)  # corrected spelling
    linkedin=Column(String, nullable=True)
    github=Column(String, nullable=True)
    portfolio=Column(String, nullable=True)
    resume=Column(String, nullable=True)
    need_sponsorship=Column(Boolean, nullable=True)
    veteran=Column(Boolean, nullable=True)
    disability=Column(Boolean, nullable=True)
    locations=Column(String, nullable=True)
    race=Column(String, nullable=True)
    gender=Column(String, nullable=True)

    # Link candidate information to a user account
    user = relationship("User")

def __repr__(self):
    return f"<Candidate(FullName={self.full_Name}, Email={self.email})>"
