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
    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False)
    phone_number = Column(String(14), nullable=False)
    date_of_birth = Column(Date, nullable=False)
    degree = Column(String, nullable=False)
    major = Column(String, nullable=False)
    school = Column(String, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    cgpa = Column(Numeric(3, 2), nullable=False)
    skills = Column(String, nullable=False)
    company_name = Column(String, nullable=False)
    job_name = Column(String, nullable=False)
    description = Column(String, nullable=False)
    job_titles = Column(String, nullable=False)  # corrected spelling

    # Link candidate information to a user account
    user = relationship("User")

def __repr__(self):
    return f"<Candidate(FullName={self.FullName}, Email={self.Email})>"
