from fastapi import Depends, HTTPException, Cookie, Header, status
from typing import Optional
import jwt
from datetime import datetime, timedelta, timezone
import os
from dotenv import load_dotenv #for .env files
from db import get_db
from sqlalchemy.orm import Session


JWT_ALGORITHM = "HS256"   # ensures the token issued by trusted party(Using a shared secret) and has not been changed suring transit.
JWT_EXPIRATION_MINUTES = 15
JWT_SECRET = os.getenv("SECRET_KEY", "your_default_jwt_secret_key")
def create_jwt_token(user_id: int,user_email: str, expires_in_minutes: int) -> str:   # -> represents the tokn to be in string format
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_in_minutes)
    payload = {"user_id": user_id,"sub": user_email, "exp": expire} #sub means subject, token will had this info
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM) # encoding into a string, jwt_secret id for tokens authenticity.
    return token

def get_current_user(db: Session = Depends(get_db),
                    authorization: Optional[str]= Header(None),
                    access_token_cookie: Optional[str] = Cookie(None),
                    refresh_token_cookie: Optional[str]=Cookie(None))-> dict:
    print('Received token:')
    #Determine which token to use:
    token_value= None
    if authorization:
        if authorization.startswith('Bearer'):
            token_value = authorization.split(' ')[1]
        else:
            raise HTTPException(
                status_code = status.HTTP_401_UNAUTHORIZED,
                detail = 'Invalid authenticaton scheme in header'

            )
    elif access_token_cookie:
        token_value = access_token_cookie
        #pass # because token from the cookie parameter is already set.
    elif refresh_token_cookie:
        #we intentionally don't decode the refresh token here
        #The refresh token logic is handled in the refresh endpoint.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail = "Access token expired.Please refresh"
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail = "Not Authenticated: No token provided"
        )
    try:
        payload = jwt.decode(token_value, JWT_SECRET, algorithms = [JWT_ALGORITHM])
        user_id = payload.get("user_id")
        user_email = payload.get("sub")
        if user_id is None or user_email is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing UserId/UserEmail")
        return {"user_id" : user_id, "email": user_email}
    except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code = status.HTTP_401_UNAUTHORIZED,
                detail = 'Access token expired.Please refresh.'
            )

    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "Invalid Access Token"
        )


        
