"""
API routes for student academic data (CGPA)
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from bson import ObjectId
from loguru import logger

from app.database import get_database
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/cgpa", tags=["cgpa"])


@router.get("/me")
async def get_my_cgpa(current_user: dict = Depends(get_current_user)):
    """Get CGPA data for the currently logged-in user"""
    try:
        db = get_database()
        user_email = current_user.get("email")
        
        if not user_email:
            raise HTTPException(status_code=400, detail="User email not found in token")
        
        # Find CGPA data by email
        cgpa_data = await db.cgpa.find_one({"email": user_email})
        
        if not cgpa_data:
            raise HTTPException(status_code=404, detail="CGPA data not found")
        
        # Convert ObjectId to string
        cgpa_data["_id"] = str(cgpa_data["_id"])
        
        return cgpa_data
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching CGPA data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching CGPA data: {str(e)}")


@router.get("/{user_email}")
async def get_student_cgpa(user_email: str, current_user: dict = Depends(get_current_user)):
    """Get CGPA data for a student by email"""
    try:
        db = get_database()
        
        # Find CGPA data by email
        cgpa_data = await db.cgpa.find_one({"email": user_email})
        
        if not cgpa_data:
            raise HTTPException(status_code=404, detail="CGPA data not found")
        
        # Convert ObjectId to string
        cgpa_data["_id"] = str(cgpa_data["_id"])
        
        return cgpa_data
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching CGPA data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching CGPA data: {str(e)}")
