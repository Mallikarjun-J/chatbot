"""
Authentication middleware for FastAPI
JWT token validation and user authentication
"""

from fastapi import HTTPException, Security, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from datetime import datetime, timedelta
from typing import Optional
from bson import ObjectId

from app.config import settings
from app.database import map_document, get_database
from app.models.schemas import UserRole


security = HTTPBearer()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(seconds=settings.JWT_EXPIRES_IN)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    
    return encoded_jwt


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
):
    """
    Get current user from JWT token
    Dependency for protected routes
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("userId")
        
        if user_id is None:
            raise credentials_exception
        
    except JWTError:
        raise credentials_exception
    
    # Get user from database
    database = get_database()
    user = await database.users.find_one({"_id": ObjectId(user_id)})
    
    if user is None:
        raise credentials_exception
    
    return map_document(user)


async def get_current_active_admin(current_user: dict = Depends(get_current_user)):
    """Require admin role"""
    if current_user["role"] != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


async def get_current_active_teacher_or_admin(current_user: dict = Depends(get_current_user)):
    """Require teacher or admin role"""
    if current_user["role"] not in [UserRole.ADMIN.value, UserRole.TEACHER.value]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher or admin access required"
        )
    return current_user


def require_roles(allowed_roles: list[UserRole]):
    """
    Dependency factory for role-based access control
    
    Usage:
        @router.get("/endpoint", dependencies=[Depends(require_roles([UserRole.ADMIN]))])
    """
    async def role_checker(current_user: dict = Depends(get_current_user)):
        user_role = current_user["role"]
        if user_role not in [role.value for role in allowed_roles]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {[r.value for r in allowed_roles]}"
            )
        return current_user
    
    return role_checker
