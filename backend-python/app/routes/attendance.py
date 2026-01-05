"""
API routes for student attendance data
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from bson import ObjectId
from loguru import logger

from app.database import get_database
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/attendance", tags=["attendance"])


@router.get("/me")
async def get_my_attendance(current_user: dict = Depends(get_current_user)):
    """Get attendance data for the currently logged-in user"""
    try:
        db = get_database()
        user_email = current_user.get("email")
        
        if not user_email:
            raise HTTPException(status_code=400, detail="User email not found in token")
        
        # Find attendance data by email
        attendance_data = await db.attendance.find_one({"email": user_email})
        
        if not attendance_data:
            raise HTTPException(status_code=404, detail="Attendance data not found")
        
        # Convert ObjectId to string
        attendance_data["_id"] = str(attendance_data["_id"])
        
        return attendance_data
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching attendance data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching attendance data: {str(e)}")


@router.get("/{user_email}")
async def get_student_attendance(user_email: str, current_user: dict = Depends(get_current_user)):
    """Get attendance data for a student by email"""
    try:
        db = get_database()
        
        # Find attendance data by email
        attendance_data = await db.attendance.find_one({"email": user_email})
        
        if not attendance_data:
            raise HTTPException(status_code=404, detail="Attendance data not found")
        
        # Convert ObjectId to string
        attendance_data["_id"] = str(attendance_data["_id"])
        
        return attendance_data
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching attendance data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching attendance data: {str(e)}")
