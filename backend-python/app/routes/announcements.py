"""
Announcements routes
GET /api/announcements - Get all
POST /api/announcements - Create (admin/teacher)
PUT /api/announcements/:id - Update
DELETE /api/announcements/:id - Delete
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional
from bson import ObjectId
from datetime import datetime

from ..database import get_database
from .auth import get_current_user

router = APIRouter()

class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    eventDate: Optional[str] = None
    eventTime: Optional[str] = None
    location: Optional[str] = None

class AnnouncementUpdate(BaseModel):
    title: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    eventDate: Optional[str] = None
    eventTime: Optional[str] = None
    location: Optional[str] = None

@router.get("/api/announcements")
async def get_announcements():
    """Get all announcements (public)"""
    db = get_database()
    announcements = await db.announcements.find().sort("date", -1).to_list(length=1000)
    
    # Convert ObjectId to string
    for ann in announcements:
        ann["id"] = str(ann.pop("_id"))
        if "date" in ann and ann["date"]:
            ann["date"] = ann["date"].isoformat()
    
    return announcements

@router.post("/api/announcements")
async def create_announcement(announcement: AnnouncementCreate, current_user: dict = Depends(get_current_user)):
    """Create new announcement (admin/teacher only)"""
    if current_user.get("role") not in ["Admin", "Teacher"]:
        raise HTTPException(status_code=403, detail="Admin or Teacher access required")
    
    db = get_database()
    
    new_announcement = {
        "title": announcement.title,
        "content": announcement.content,
        "date": datetime.utcnow(),
        "createdBy": current_user.get("userId")
    }
    
    if announcement.eventDate:
        new_announcement["eventDate"] = announcement.eventDate
    if announcement.eventTime:
        new_announcement["eventTime"] = announcement.eventTime
    if announcement.location:
        new_announcement["location"] = announcement.location
    
    result = await db.announcements.insert_one(new_announcement)
    new_announcement["id"] = str(result.inserted_id)
    new_announcement.pop("_id", None)
    new_announcement["date"] = new_announcement["date"].isoformat()
    
    return new_announcement

@router.put("/api/announcements/{announcement_id}")
async def update_announcement(announcement_id: str, announcement: AnnouncementUpdate, current_user: dict = Depends(get_current_user)):
    """Update announcement (admin/teacher only)"""
    if current_user.get("role") not in ["Admin", "Teacher"]:
        raise HTTPException(status_code=403, detail="Admin or Teacher access required")
    
    db = get_database()
    
    try:
        object_id = ObjectId(announcement_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid announcement ID")
    
    update_data = {
        "title": announcement.title,
        "content": announcement.content
    }
    
    if announcement.eventDate:
        update_data["eventDate"] = announcement.eventDate
    if announcement.eventTime:
        update_data["eventTime"] = announcement.eventTime
    if announcement.location:
        update_data["location"] = announcement.location
    
    result = await db.announcements.update_one(
        {"_id": object_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    return {"message": "Announcement updated successfully"}

@router.delete("/api/announcements/{announcement_id}")
async def delete_announcement(announcement_id: str, current_user: dict = Depends(get_current_user)):
    """Delete announcement (admin/teacher only)"""
    if current_user.get("role") not in ["Admin", "Teacher"]:
        raise HTTPException(status_code=403, detail="Admin or Teacher access required")
    
    db = get_database()
    
    try:
        object_id = ObjectId(announcement_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid announcement ID")
    
    result = await db.announcements.delete_one({"_id": object_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    return {"message": "Announcement deleted successfully"}

@router.delete("/api/announcements/all")
async def delete_all_announcements(current_user: dict = Depends(get_current_user)):
    """Delete all announcements (admin only)"""
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    result = await db.announcements.delete_many({})
    
    return {
        "message": f"Successfully deleted {result.deleted_count} announcements",
        "deletedCount": result.deleted_count
    }
