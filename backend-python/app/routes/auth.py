"""
Authentication routes
Login, OTP verification, and password reset
"""

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from datetime import timedelta
from bson import ObjectId

from app.database import verify_password, map_document, get_database, hash_password
from app.middleware.auth import create_access_token, get_current_user
from app.config import settings
from app.services.email_service import email_service
from app.services.otp_service import otp_service
import logging

logger = logging.getLogger(__name__)


router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class OTPRequest(BaseModel):
    user_id: str
    otp_code: str


class SendOTPRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyResetCodeRequest(BaseModel):
    email: EmailStr
    reset_code: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_code: str
    new_password: str


class TokenResponse(BaseModel):
    token: str
    user: dict


@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest):
    """
    User login endpoint
    Returns JWT token and user data
    """
    # Ensure database connection
    database = get_database()

    # Find user by email
    user = await database.users.find_one({"email": credentials.email})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Verify password
    if not verify_password(credentials.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Create access token
    access_token = create_access_token(
        data={
            "userId": str(user["_id"]),
            "email": user["email"],
            "role": user["role"]
        },
        expires_delta=timedelta(seconds=settings.JWT_EXPIRES_IN)
    )
    
    # Prepare user data (without password)
    user_data = map_document(user)
    user_data.pop("password", None)
    
    return {
        "token": access_token,
        "user": user_data
    }


@router.post("/verify-token")
async def verify_token(current_user: dict = Depends(get_current_user)):
    """
    Verify JWT token and return user data
    """
    # Remove password from response
    user_data = current_user.copy()
    user_data.pop("password", None)
    
    return {
        "valid": True,
        "user": user_data
    }


@router.post("/send-otp")
async def send_otp(request: SendOTPRequest):
    """
    Send OTP to user's email (for secure login)
    """
    database = get_database()
    
    # Find user and verify credentials
    user = await database.users.find_one({"email": request.email})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Verify password
    if not verify_password(request.password, user["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    try:
        # Generate OTP
        otp_code = await otp_service.create_otp(
            user_id=str(user["_id"]),
            email=request.email,
            purpose="login"
        )
        
        # Send OTP email
        email_sent = await email_service.send_otp_email(
            to_email=request.email,
            otp_code=otp_code,
            user_name=user["name"],
            role=user["role"]
        )
        
        if not email_sent:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send OTP email. Please check email configuration."
            )
        
        return {
            "success": True,
            "message": "OTP sent to your email",
            "user_id": str(user["_id"])
        }
        
    except Exception as e:
        logger.error(f"Error sending OTP: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send OTP"
        )


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(request: OTPRequest):
    """
    Verify OTP and return JWT token
    """
    database = get_database()
    
    # Verify OTP
    is_valid = await otp_service.verify_otp(
        user_id=request.user_id,
        otp_code=request.otp_code,
        purpose="login"
    )
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired OTP"
        )
    
    # Get user
    user = await database.users.find_one({"_id": ObjectId(request.user_id)})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Create access token
    access_token = create_access_token(
        data={
            "userId": str(user["_id"]),
            "email": user["email"],
            "role": user["role"]
        },
        expires_delta=timedelta(seconds=settings.JWT_EXPIRES_IN)
    )
    
    # Prepare user data (without password)
    user_data = map_document(user)
    user_data.pop("password", None)
    
    return {
        "token": access_token,
        "user": user_data
    }


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """
    Send password reset code to user's email
    """
    database = get_database()
    
    # Find user
    user = await database.users.find_one({"email": request.email})
    
    if not user:
        # Don't reveal if email exists for security
        return {
            "success": True,
            "message": "If the email exists, a reset code has been sent"
        }
    
    try:
        # Generate reset code
        reset_code = await otp_service.create_reset_code(request.email)
        
        if not reset_code:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to generate reset code"
            )
        
        # Send reset email
        email_sent = await email_service.send_password_reset_email(
            to_email=request.email,
            reset_code=reset_code,
            user_name=user["name"]
        )
        
        if not email_sent:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send reset email. Please check email configuration."
            )
        
        return {
            "success": True,
            "message": "Password reset code sent to your email"
        }
        
    except Exception as e:
        logger.error(f"Error sending reset code: {str(e)}")
        # Don't reveal internal errors to user
        return {
            "success": True,
            "message": "If the email exists, a reset code has been sent"
        }


@router.post("/verify-reset-code")
async def verify_reset_code(request: VerifyResetCodeRequest):
    """
    Verify password reset code
    """
    is_valid = await otp_service.verify_reset_code(
        email=request.email,
        reset_code=request.reset_code
    )
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired reset code"
        )
    
    return {
        "success": True,
        "message": "Reset code verified successfully"
    }


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """
    Reset user password with verified code
    """
    database = get_database()
    
    # Verify reset code again
    is_valid = await otp_service.verify_reset_code(
        email=request.email,
        reset_code=request.reset_code
    )
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired reset code"
        )
    
    # Validate new password
    if len(request.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long"
        )
    
    # Hash new password
    hashed_password = hash_password(request.new_password)
    
    # Update user password
    result = await database.users.update_one(
        {"email": request.email},
        {"$set": {"password": hashed_password}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Delete used reset code
    await database.password_resets.delete_many({"email": request.email})
    
    return {
        "success": True,
        "message": "Password reset successfully"
    }

