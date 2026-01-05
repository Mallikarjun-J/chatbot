"""
Teacher Timetables routes - Teachers manage their own personal teaching schedules
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from bson import ObjectId
from datetime import datetime

from ..database import get_database
from .auth import get_current_user

router = APIRouter()

class TeacherTimeSlot(BaseModel):
    time: str
    subject: str
    department: Optional[str] = None
    semester: str
    section: str
    room: Optional[str] = None

class TeacherTimetableCreate(BaseModel):
    branch: str = Field(..., min_length=1)  # Timetable name
    days: Dict[str, List[TeacherTimeSlot]]

@router.post("/api/timetables/teacher")
async def create_teacher_timetable(
    timetable_data: TeacherTimetableCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create personal teaching schedule (teachers only)"""
    if current_user.get("role") != "Teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    
    db = get_database()
    
    # Convert Pydantic models to dicts for MongoDB
    days_dict = {}
    for day, slots in timetable_data.days.items():
        days_dict[day] = [slot.dict() for slot in slots]
    
    timetable_doc = {
        "branch": timetable_data.branch,
        "section": "Teacher Schedule",  # Marker for teacher timetables
        "semester": "1",  # Default value
        "days": days_dict,
        "teacherEmail": current_user.get("email"),
        "teacherId": str(current_user.get("_id")),
        "teacherName": current_user.get("name"),
        "createdAt": datetime.utcnow(),
        "status": "active",
        "type": "manual"
    }
    
    # Insert new teacher timetable
    result = await db.teachers_timetable.insert_one(timetable_doc)
    timetable_id = str(result.inserted_id)
    
    return {
        "message": f"Teaching schedule '{timetable_data.branch}' created successfully",
        "id": timetable_id,
        "branch": timetable_data.branch
    }

@router.get("/api/timetables/teacher")
async def get_teacher_timetables(current_user: dict = Depends(get_current_user)):
    """Get teacher's personal teaching schedules (teachers only)"""
    if current_user.get("role") != "Teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    
    db = get_database()
    
    # Get only this teacher's timetables - primary filter by email (most reliable)
    teacher_email = current_user.get("email")
    
    query = {
        "teacherEmail": {"$regex": f"^{teacher_email}$", "$options": "i"}
    }
    
    timetables = await db.teachers_timetable.find(query).sort("createdAt", -1).to_list(length=1000)
    
    for tt in timetables:
        tt["id"] = str(tt.pop("_id"))
        if "createdAt" in tt and tt["createdAt"]:
            tt["createdAt"] = tt["createdAt"].isoformat()
    
    return timetables

@router.delete("/api/timetables/teacher/{timetable_id}")
async def delete_teacher_timetable(
    timetable_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete teacher's personal teaching schedule"""
    if current_user.get("role") != "Teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    
    db = get_database()
    
    try:
        object_id = ObjectId(timetable_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid timetable ID")
    
    # Verify ownership
    timetable = await db.teachers_timetable.find_one({"_id": object_id})
    
    if not timetable:
        raise HTTPException(status_code=404, detail="Timetable not found")
    
    # Check if this timetable belongs to the current teacher
    teacher_email = current_user.get("email")
    if timetable.get("teacherEmail") != teacher_email:
        raise HTTPException(status_code=403, detail="You can only delete your own timetables")
    
    # Delete from database
    result = await db.teachers_timetable.delete_one({"_id": object_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Timetable not found")
    
    return {"message": "Teaching schedule deleted successfully"}

@router.put("/api/timetables/teacher/{timetable_id}")
async def update_teacher_timetable(
    timetable_id: str,
    timetable_data: TeacherTimetableCreate,
    current_user: dict = Depends(get_current_user)
):
    """Update teacher's personal teaching schedule"""
    if current_user.get("role") != "Teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    
    db = get_database()
    
    try:
        object_id = ObjectId(timetable_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid timetable ID")
    
    # Verify ownership
    timetable = await db.teachers_timetable.find_one({"_id": object_id})
    
    if not timetable:
        raise HTTPException(status_code=404, detail="Timetable not found")
    
    # Check if this timetable belongs to the current teacher
    teacher_email = current_user.get("email")
    if timetable.get("teacherEmail") != teacher_email:
        raise HTTPException(status_code=403, detail="You can only update your own timetables")
    
    # Convert Pydantic models to dicts for MongoDB
    days_dict = {}
    for day, slots in timetable_data.days.items():
        days_dict[day] = [slot.dict() for slot in slots]
    
    # Update document
    update_data = {
        "branch": timetable_data.branch,
        "days": days_dict,
        "updatedAt": datetime.utcnow()
    }
    
    result = await db.teachers_timetable.update_one(
        {"_id": object_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0 and result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Timetable not found")
    
    return {
        "message": f"Teaching schedule '{timetable_data.branch}' updated successfully",
        "id": timetable_id
    }
