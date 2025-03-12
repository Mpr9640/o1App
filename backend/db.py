import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://username:password@localhost:9640/app_db")
#JWT_SECRET = os.getenv("SECRET_KEY", "YOUR_JWT_SECRET_KEY")

#create the SQLAlchemy engine
engine = create_engine(DATABASE_URL)

#create a configured " Session" class will be used to interact with database
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
#autoflush disables autoflushing of changes to the db before queries are executed.

#Base class for our models
Base = declarative_base()
