from sqlalchemy import Column, Integer, String, DateTime, Boolean
from db import Base
import datetime
from datetime import datetime

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

    