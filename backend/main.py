from fastapi import FastAPI, HTTPException, status, Depends, Response, Cookie
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import datetime
from datetime import datetime, timedelta, timezone # for utnow() replacement
import jwt
import bcrypt
import secrets
import os # for .env files
import smtplib # for send email to reset password.
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv #for .env files
import logging   # imported because we are facing problem with the error unable to see that is the typeerror e.preventdefault is not a function.
logger = logging.getLogger("uvicorn.error")
from fastapi import Request   # for same prevent default error.
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr  # when we see probl;em with pydantic like email.



app = FastAPI()


# Adjust the allowed origins to your frontend's URL
origins = [
    "http://localhost:3000"
    #add other origins if needed

]
app.add_middleware(
    CORSMiddleware,
    allow_origins = origins, # Allow specified origins
    allow_credentials = True,
    allow_methods = ["*"],  # ALlow all HTTP methods (GET, POST, etc..)
    allow_headers=["*"], 
)

load_dotenv()
# secret key and configuration for JWT( use a secure key in production)
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_MINUTES = 60
JWT_SECRET = os.getenv("SECRET_KEY", "your_default_jwt_secret_key")

class ForgotPasswordRequest(BaseModel):
    email: EmailStr
class ResendForgotPasswordRequest(BaseModel):
    email: EmailStr


@app.exception_handler(Exception)
async def global_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail":"An unexpected error occured"}

    )


#Import the database session and models
from sqlalchemy.orm import Session # import Session for type hints
from db import SessionLocal
from models import User

#dependency to get db session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# In-memory " database" for demonstration purpose
#users_db={}



class UserRegister(BaseModel):
    email: EmailStr
    password: str
class UserLogin(BaseModel):
    email: EmailStr
    password: str
class ConfirmEmailRequest(BaseModel):
    token: str

# Utility function to create a JWT token for authenticates users
def create_jwt_token(user_email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRATION_MINUTES)
    payload = {"sub": user_email, "exp": expire}
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token
@app.post("/api/register")
async def register(user: UserRegister, db: Session = Depends(get_db)):
    #checking if user is available in db
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User already exists"

        )
    # Hash the password using bcrypt
    #salt = bcrypt.gensalt()
    #hashed_password = bcrypt.hashpw(user.password.encode("utf-8"), salt)
    #create a payload with the registration info)
    payload ={
        "email": user.email,
        "password": user.password,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRATION_MINUTES)
    }
    #Generating a confirm token
    confirm_token = jwt.encode(payload,JWT_SECRET, algorithm=JWT_ALGORITHM)
    #confirm_token = secrets.token_urlsafe(32)
    #confirm_token_expires = datetime.now(timezone.utc) + timedelta(24) # token valid for 24 hrs.
    # save the new user to our "databse"
    send_confirmation_email(user.email, confirm_token)
    return { "msg": "Registration Intiated.Please Check your email to Confirmt the registration"}
    #new_user = User(email = user.email, password = hashed_password.decode("utf-8"), is_confirmed = False, confirm_token=confirm_token, confirm_token_expires = confirm_token_expires) # stores as bytes if you take of .decode, now it is storing as string.
    #db.add(new_user)
    #db.commit()
    #db.refresh(new_user)
    #send_confirmation emai
    
# return {"msg": "User registered succesfully", "user_id": new_user.id}

def send_confirmation_email(recipient_email: str, token: str):
    try:
        sender_email = os.getenv("EMAIL_USER","maddulasaisivareddy@gmail.com")
        sender_password = os.getenv("EMAIL_PASS", "EMAIL_PASSWORD")
        smtp_server = os.getenv("SMTP_SERVER", "PUT YOUR SERVER")
        smtp_port = int(os.getenv("SMTP_PORT", 2525))

        #construct the confirmation url
        confirm_url = f"http://localhost:3000/confirm_email?token={token}"
        subject = "Email confirmation"
        body = (
            f"plese click the following link to confirm the email.\n\n{confirm_url}"
        )
        msg= MIMEMultipart()
        msg["From"] = sender_email
        msg["to"] = recipient_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))
        msg.attach(MIMEText(f'<a href="{confirm_url}">Confirm Email</a>', "html"))

        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(sender_email, sender_password)
        server.sendmail(sender_email, recipient_email, msg.as_string())
        server.quit()
        logger.info(f"Confirmation email was sent successfully to {recipient_email}")
    except Exception as e:
        logger.error(f"failed to send an confirmation email: {e}")

@app.post("/api/confirm_email")
async def confirm_email(request: ConfirmEmailRequest, db: Session = Depends(get_db)):
    try:
        payload=jwt.decode(request.token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email = payload.get("email")
        password = payload.get("password")
        if not email or not password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Invalid token")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token Expired")
    
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(password.encode("utf-8"), salt)
    new_user = User(email=email, password=hashed_password.decode("utf-8"),is_confirmed=True)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"msg": "Email confirmed Succesfully"}
#@app.post("/api/resend_confirm_email")
#async def resend_confirm_email(email: EmailStr, db: Session=Depends(get_db)):
    #db_user=db.query(User).filter(User.email==email).first()
    #if db.user.is_confirmed:
        #raise HTTPException(Status_code = status.HTTP_400_BAD_Request, detail = "User_already_confirmed")
    #confirm_token=secrets.token_urlsafe(32)
    #token_expires=datetime.now(timezone.utc) + timedelta(hours=24)
    #db_user.confirm_token=confirm_token
    #db_user.confirm_token_expires=token_expires
    #db_user.commit()
    #send_confirmation_email(db_user.email, confirm_token)
    #return{"msg":"Confirmation Email was sent"}

@app.post ("/api/login")
async def login(user: UserLogin, response: Response, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if not db_user:
        raise HTTPException(
            status_code= status.HTTP_400_BAD_REQUEST,
            detail= "User does not exist"

        )
    # verifying the provides password against the  user password
    if not bcrypt.checkpw(user.password.encode("utf-8"), db_user.password.encode("utf-8")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="invalid credentials"
        )
    token = create_jwt_token(user.email)
    # set an HTTP only cookie with the token
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",  #"none", which is not used to accept for only samw port and domain.
        max_age=JWT_EXPIRATION_MINUTES*60

    )
    return {"token": token, "user": {"email": user.email}}

# to validate the cookie and returns the user's session details.
@app.get("/api/me")
async def get_current_user(db: Session = Depends(get_db), token: str = Cookie(None)):
    if token is None:
       raise HTTPException(status_code=401, detail= "Not authenticated")
    try:
       payload = jwt. decode(token, JWT_SECRET, algorithms = [JWT_ALGORITHM])
       email = payload.get("sub")
       if email is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.PyJWTError:
       raise HTTPException(status_code=401,detail = "Invalid token")
    db_user = db.query(User).filter(User.email == email).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"email": db_user.email} 


@app.post("/api/forgot_password")
async def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = request.email
    logger.info(f"Received forgot password request for eamil : {email}")
    db_user = db.query(User).filter(User.email == email).first()

    if not db_user:
        logger.error(f"User with email{email} not found.")
        #return {"msg": "User does not exist"}
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail= "User does not exist"
        )
    # generate a secure token, store it and send it an email.
    # here we will just return a placeholder message
    reset_token = secrets.token_urlsafe(32)
    db_user.reset_token = reset_token
    db_user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    db.commit()
    send_reset_email(db_user.email, reset_token)
    logger.info(f"Reset token generated and email sent to {db_user.email}")
    return{"msg":"Password resent link sent"}
@app.post("/api/resend_forgot_password")
async def resend_forgot_password(request: ResendForgotPasswordRequest, db: Session= Depends(get_db)):
    email=request.email
    db_user=db.query(User).filter(User.email==email).first()
    if not db_user:
        logger.error(f"User with email{email} not found.")
        #return {"msg": "User does not exist"}
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail= "User does not exist"
        )
    if db_user.reset_token and db_user.reset_token_expires > datetime.now(timezone.utc):
        reset_token = db_user.reset_token
    reset_token = secrets.token_urlsafe(32)
    db_user.reset_token=reset_token
    db_user.reset_token_expires=datetime.now(timezone.utc) + timedelta(hours=1)
    db.commit()
    send_reset_email(db_user.email, reset_token)
    return{"msg":"Resend Email was sent succesfully"}
from fastapi import Body # for resetpassword

class ResetPasswordRequest(BaseModel): # fro resetpassword
    token: str
    new_password: str
@app.post('/api/reset_password')
async def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    # find the user by matching the reset token
    db_user=db.query(User).filter(User.reset_token == request.token).first()
    if not db_user:
        raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail = "Invalid or Expired token")
    #check if token is expired
    if db_user.reset_token_expires < datetime.now(timezone.utc):
        raise HTTPException(status_code = status.HTTP_400_BAD_REQUEST, detail="Token Expired")
    #hash the new password
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(request.new_password.encode("utf-8"),salt)
    db_user.password = hashed_password.decode("utf-8")

    #clear the reset token and expiration
    db_user.reset_token = None
    db_user.reset_token_expires = None
    db.commit()
    return {"msg": "Passowrd has been reset succesfully"}
@app.post("/api/logout")
async def logout(response: Response):
    
    #Delete the 'token' cookie by setting it to an empty string with an max_age=0
    response.delete_cookie(key='token')
    return {"msg": "Logged out Successfully"}


def send_reset_email(recipient_email: str, token: str):

    try:


    # Load smtp configuration from environment variables
        sender_email = os.getenv("EMAIL_USER", "your_email@example.com")
        sender_password = os.getenv("EMAIL_PASS", "YOUR EMAIL_PASSWORD")
        smtp_server = os.getenv("SMTP_SERVER", "SMTP_EXAMPLE.COM")
        smtp_port= int(os.getenv("SMTP_PORT",2525))
    # Construct reset URL and email change
        frontend_url=os.getenv("FRONTEND_URL", " http://localhost:3000")
        backend_url = "http://127.0.0.1:8000"
        reset_url = f"{frontend_url}/reset_password?token={token}" 
        subject = "Password reset request"
        body = f" Click the following link to reset your password:\n \nif you did not request a password reset, please ignore this email."
        
        #create the email message

        msg = MIMEMultipart()
        msg["From"] = sender_email
        msg["To"] = recipient_email
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))
        msg.attach(MIMEText(f'<a href="{reset_url}">Reset Password</a>', "html"))

        logger.info(f"sending email from {sender_email} to {recipient_email}")
        logger.debug(f"Email suject:{subject}")
        logger.debug(f'Email body: {body}')

        # Connect to the smtp server and send the email
        server = smtplib. SMTP(smtp_server, smtp_port)
        server. starttls() # fro tls encryption
        server. login(sender_email, sender_password)
        server.sendmail(sender_email, recipient_email, msg.as_string())
        server.quit()
        logger.info(f"Reset emial sent succesfully to { recipient_email}")
    except Exception as e:
        logger.error(f"Failed to send email :{e}")

    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)



                    







