from db import engine, Base
import models #Ensure that your models are imported so they register with Base

Base.metadata.create_all(bind=engine)

# engine is SqlAL instance used to connect to db
#Base.metadata, keep track of all meta data  associated with your models
#create_all: genrate database tables if they dont exist.
#bind=engine, specifies which database connection to use 