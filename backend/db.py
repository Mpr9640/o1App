import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

#DB_HOST = os.getenv("DB_HOST", "localhost")
#DB_NAME = os.getenv("DB_NAME", "app_db")
#DB_USER = os.getenv("DB_USER", "postgres")
#DB_PASSWORD = os.getenv("DB_PASSWORD", "secret")
#DB_PORT = os.getenv("DB_PORT", "9640")
#DATABASE_URL = os.getenv(f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://username:password@localhost:9640/app_db")
#JWT_SECRET = os.getenv("SECRET_KEY", "YOUR_JWT_SECRET_KEY")

#create the SQLAlchemy engine
engine = create_engine(DATABASE_URL)

#create a configured " Session" class will be used to interact with database
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
#autoflush disables autoflushing of changes to the db before queries are executed.

#Base class for our models
Base = declarative_base()
#dependency to get db session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

