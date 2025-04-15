from fastapi import FastAPI
from fastapi import Request   # for same prevent default error.Incoming HTTP request received by server.
from fastapi.middleware.cors import CORSMiddleware
import os # for .env files , Manages computer hardware and software resources.
from dotenv import load_dotenv #for .env files
import logging   # imported because we are facing problem with the error unable to see that is the typeerror e.preventdefault is not a function.
import uvicorn
from fastapi.responses import JSONResponse # paylaod returned by a web service from a  request.
from api import candidate, user # importing routers
#import dependencies
#from user, candidate  import  as user
from fastapi.exceptions import RequestValidationError
load_dotenv()

import re

logger = logging.getLogger("uvicorn.error")


app = FastAPI()


frontend_url = os.getenv('FRONTEND_URL',"http://localhost:3000")

app.add_middleware(    
    CORSMiddleware,
   
    allow_origins=[frontend_url,'chrome-extensions://neobfeaageldckcenkpcfihbjkfkngcb','https://virtoratech.zohorecruit.com','https://infynixsync.zohorecruit.com/','https://www.linkedin.com','https://www1.jobdiva.com','https://recruiting.paylocity.com',
                   'https://recruiting2.ultipro.com','https://jobs.lever.co/','https://job-boards.greenhouse.io'
                   ],

    allow_credentials=True,
    allow_methods=["*"],  # ALlow all HTTP methods (GET, POST, etc..)
    allow_headers=["*"], 
)

@app.exception_handler(Exception)
async def global_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}")
    response = JSONResponse(
        status_code=500,
        content={"detail":"An unexpected error occured"}

    )
#Manually add CORS headers
    response.headers["Access-Control-Allow-Origin"] = frontend_url
    return response

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc:RequestValidationError):
    print(f'Validation Error: {exc}')
    response = JSONResponse(status_code=422, content={"detail": exc.errors(), "body": exc.body},)
    response.headers["Access-Control-Allow-Origin"] = frontend_url
    return response
#Include routers from separate modules.
app.include_router(candidate.router, prefix="/api", tags=['Candidate'])
app.include_router(user.router, prefix="/api",tags=["User"])
#app.include_router(dependencies.router, prefix="/api", tags=["Dependencies"])


if __name__ == "__main__":
    port = int(os.environ.get("PORT",8000))
    host=os.environ.get("HOST","localhost")
    uvicorn.run("main:app", host=host, port=port, reload=True)
  


                    
# comments 


#envi = os.getenv("ENVIRONMENT","development").lower()
#if envi == 'production':
    #frontend_url = os.getenv('FRONTEND_URL')
    #if not frontend_url:
        #raise RuntimeError("FRONTEND_URL IS NOT SET FOR PRODUTION")
    #app.add_middleware(
        #CORSMiddleware,
        #allow_origins = [frontend_url],
        #allow_credentials = True,
        #allow_methods = ['*'],
        #allow_headers = ['*'],

    #)
#else:
    #frontend_url_regex=os.getenv('FRONTEND_URL')
    #if not frontend_url_regex:
        #raise RuntimeError('Frontend url regex is not founded')
    #frontend_url = re.compile(frontend_url_regex)
    #literal_origin = "http://localhost:3002"
    #app.add_middleware(
        #CORSMiddleware,
        #allow_origins=[literal_origin],
        #allow_origin_regex = frontend_url_regex,
        #allow_credentials = True,
        #allow_methods = ['*'],
        #allow_headers = ['*'],

    #)

#CORS has same orgin policy
#Cross orgin resource sharing used to give access or restrict resources on web server requested by web pages hosted by different domain.

# Adjust the allowed origins to your frontend's URL
#origins = [r"http://localhost:\d+", frontend_url]
    #add other origins if needed]


    #allow_origins=[frontend_url] if envi == 'production' else ['*'],

  #uvicorn.run("main:app", host="localhost", port=8000)

