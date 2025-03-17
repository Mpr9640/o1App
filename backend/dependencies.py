from fastapi import Depends, HTTPException, Cookie
import jwt
from datetime import datetime, timedelta, timezone
import os
from dotenv import load_dotenv #for .env files

JWT_ALGORITHM = "HS256"   # ensures the token issued by trusted party(Using a shared secret) and has not been changed suring transit.
JWT_EXPIRATION_MINUTES = 60
JWT_SECRET = os.getenv("SECRET_KEY", "your_default_jwt_secret_key")
def create_jwt_token(user_id: int,user_email: str) -> str:   # -> represents the tokn to be in string format
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRATION_MINUTES)
    payload = {"user_id": user_id,"sub": user_email, "exp": expire} #sub means subject, token will had this info
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM) # encoding into a string, jwt_secret id for tokens authenticity.
    return token
def get_current_user(token: str = Cookie(...)) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms = [JWT_ALGORITHM])
        user_id = payload.get("user_id")
        user_email = payload.get("sub")
        if user_id is None or user_email is None:
            raise HTTPException(status_code=401, detail="Missing")
        return {"user_id" : user_id, "email" : user_email}
    except jwt.PyJWTError:
        raise HTTPException(status_code = 401, detail="Invalid Token")
