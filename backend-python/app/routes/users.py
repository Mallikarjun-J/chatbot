"""
Users routes for user management
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from bson import ObjectId
from datetime import datetime
import logging

from ..database import get_database, hash_password, verify_password
from .auth import get_current_user
from ..services.email_service import email_service

logger = logging.getLogger(__name__)

router = APIRouter()

class UserCreate(BaseModel):
    name: str = Field(..., min_length=1)
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: str = Field(..., pattern="^(Admin|Teacher|Student)$")
    department: Optional[str] = None
    branch: Optional[str] = None
    section: Optional[str] = None
    year: Optional[int] = None
    semester: Optional[str] = None  # Added semester field for students

class UserUpdate(BaseModel):
    role: str = Field(..., pattern="^(Admin|Teacher|Student)$")
    branch: Optional[str] = None
    section: Optional[str] = None
    semester: Optional[str] = None

@router.get("/api/users")
async def get_users(current_user: dict = Depends(get_current_user)):
    """Get all users (admin only)"""
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    users = await db.users.find({}, {"password": 0}).to_list(length=1000)
    
    # Convert ObjectId to string for JSON serialization
    for user in users:
        user["id"] = str(user.pop("_id"))
        if "createdAt" in user and user["createdAt"]:
            user["createdAt"] = user["createdAt"].isoformat()
    
    return users

@router.post("/api/users")
async def create_user(user_data: UserCreate, current_user: dict = Depends(get_current_user)):
    """Create a new user (admin only)"""
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Check if user already exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    # Create user document
    new_user = {
        "name": user_data.name,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "role": user_data.role,
        "createdAt": datetime.utcnow()
    }
    
    # Add optional fields
    if user_data.department:
        new_user["department"] = user_data.department
    if user_data.branch:
        new_user["branch"] = user_data.branch
    if user_data.section:
        new_user["section"] = user_data.section
    if user_data.year is not None:
        new_user["year"] = user_data.year
    if user_data.semester:
        new_user["semester"] = user_data.semester
    
    result = await db.users.insert_one(new_user)
    new_user["id"] = str(result.inserted_id)
    new_user.pop("_id", None)
    new_user.pop("password")
    
    # Send welcome email (async, don't wait for it)
    try:
        await email_service.send_welcome_email(
            to_email=user_data.email,
            user_name=user_data.name,
            role=user_data.role
        )
        logger.info(f"Welcome email sent to {user_data.email}")
    except Exception as e:
        logger.error(f"Failed to send welcome email to {user_data.email}: {str(e)}")
        # Don't fail user creation if email fails
    
    return new_user

@router.put("/api/users/{user_id}")
async def update_user_role(user_id: str, user_update: UserUpdate, current_user: dict = Depends(get_current_user)):
    """Update user details (admin only)"""
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    try:
        object_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    # Build update document
    update_data = {"role": user_update.role}
    
    # Add optional fields if provided
    if user_update.branch is not None:
        update_data["branch"] = user_update.branch
    if user_update.section is not None:
        update_data["section"] = user_update.section
    if user_update.semester is not None:
        update_data["semester"] = user_update.semester
    
    result = await db.users.update_one(
        {"_id": object_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User updated successfully"}

@router.delete("/api/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a user (admin only)"""
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    try:
        object_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    # Prevent deleting yourself
    if str(object_id) == current_user.get("userId"):
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({"_id": object_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "User deleted successfully"}
