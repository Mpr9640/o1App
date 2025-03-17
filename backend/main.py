from fastapi import FastAPI
from fastapi import Request   # for same prevent default error.Incoming HTTP request received by server.
from fastapi.middleware.cors import CORSMiddleware
import os # for .env files , Manages computer hardware and software resources.
from dotenv import load_dotenv #for .env files
import logging   # imported because we are facing problem with the error unable to see that is the typeerror e.preventdefault is not a function.
import uvicorn
from fastapi.responses import JSONResponse # paylaod returned by a web service from a  request.
from api import candidate, user # importing routers
#from user, candidate  import router
load_dotenv()

logger = logging.getLogger("uvicorn.error")


app = FastAPI()


frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3001")

# Adjust the allowed origins to your frontend's URL
origins = [frontend_url,"http://localhost:3001"]
    #add other origins if needed]
app.add_middleware(    #CORS has same orgin policy
    CORSMiddleware,#Cross orgin resource sharing used to give access or restrict resources on web server requested by web pages hosted by different domain.
   
    allow_origins = origins, # Allow specified origins
    allow_credentials = True,
    allow_methods = ["*"],  # ALlow all HTTP methods (GET, POST, etc..)
    allow_headers=["*"], 
)


@app.exception_handler(Exception)
async def global_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail":"An unexpected error occured"}

    )

#Include routers from separate modules.
app.include_router(candidate.router, prefix="/api", tags=['Candidate'])
app.include_router(user.router, prefix="/api",tags=["User"])


if __name__ == "__main__":
    port = int(os.environ.get("PORT",8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)



                    







