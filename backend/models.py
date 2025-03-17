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
    Id = Column(Integer, primary_key = True, index = True)
    FirstName = Column(String, nullable=False)
    MiddleName = Column(String, nullable=True)
    LastName = Column(String, nullable=False)
    FullName= Column(String, nullable=False)
    Email= Column(String, nullable=False)
    PhoneNumber = Column(String(14), nullable=False)
    DateOfBirth = Column(String, nullable=False)
    Degree = Column(String, nullable=False)
    Major = Column(String, nullable=False)
    School = Column(String, nullable=False)
    StartDate = Column(Date, nullable=False)
    EndDate = Column(Date, nullable=False)
    CGPA = Column(Numeric(3,2), nullable=False)
    Skills = Column(String, nullable=False)
    CompanyName = Column(String, nullable=False)
    JobName = Column(String, nullable=False)
    Description = Column(String, nullable=False)
    JobTittles = Column(String, nullable=False)

    #Link candidate information to a user account
    UserId = Column(Integer, ForeignKey("users.id"),nullable=False)

    user = relationship("User")

def __repr__(self):
    return f"<Candidate(FullName={self.fullName}, email={self.email})>"
