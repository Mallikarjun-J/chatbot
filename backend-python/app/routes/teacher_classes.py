"""
Teacher Classes routes - Teachers manage their class assignments
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import Optional, List
from bson import ObjectId
from datetime import datetime

from ..database import get_database
from .auth import get_current_user

router = APIRouter()

class TeacherClass(BaseModel):
    subject: str = Field(..., min_length=1)
    department: str = Field(..., min_length=1)
    semester: str = Field(..., min_length=1)
    section: str = Field(..., min_length=1)

class TeacherClassUpdate(BaseModel):
    subject: Optional[str] = None
    department: Optional[str] = None
    semester: Optional[str] = None
    section: Optional[str] = None

@router.post("/api/teacher/classes")
async def create_teacher_class(
    class_data: TeacherClass,
    current_user: dict = Depends(get_current_user)
):
    """Create a new class assignment for teacher"""
    if current_user.get("role") != "Teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    
    db = get_database()
    
    class_doc = {
        "teacherId": current_user.get("userId"),
        "teacherName": current_user.get("name"),
        "subject": class_data.subject,
        "department": class_data.department,
        "semester": class_data.semester,
        "section": class_data.section,
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    # Check if this class already exists for this teacher
    existing = await db.teachers_timetable.find_one({
        "teacherId": current_user.get("userId"),
        "subject": class_data.subject,
        "department": class_data.department,
        "semester": class_data.semester,
        "section": class_data.section
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="This class is already in your list")
    
    result = await db.teachers_timetable.insert_one(class_doc)
    class_id = str(result.inserted_id)
    
    return {
        "message": "Class added successfully",
        "id": class_id,
        "class": class_data.dict()
    }

@router.get("/api/teacher/classes")
async def get_teacher_classes(current_user: dict = Depends(get_current_user)):
    """Get all classes for the current teacher"""
    if current_user.get("role") != "Teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    
    db = get_database()
    
    classes = await db.teachers_timetable.find({
        "teacherId": current_user.get("userId")
    }).sort("subject", 1).to_list(length=1000)
    
    for cls in classes:
        cls["id"] = str(cls.pop("_id"))
    
    return classes

@router.put("/api/teacher/classes/{class_id}")
async def update_teacher_class(
    class_id: str,
    class_data: TeacherClassUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a teacher's class"""
    if current_user.get("role") != "Teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    
    db = get_database()
    
    try:
        obj_id = ObjectId(class_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid class ID")
    
    # Verify ownership
    existing = await db.teachers_timetable.find_one({
        "_id": obj_id,
        "teacherId": current_user.get("userId")
    })
    
    if not existing:
        raise HTTPException(status_code=404, detail="Class not found")
    
    # Build update document
    update_doc = {"updatedAt": datetime.utcnow()}
    if class_data.subject is not None:
        update_doc["subject"] = class_data.subject
    if class_data.department is not None:
        update_doc["department"] = class_data.department
    if class_data.semester is not None:
        update_doc["semester"] = class_data.semester
    if class_data.section is not None:
        update_doc["section"] = class_data.section
    
    await db.teachers_timetable.update_one(
        {"_id": obj_id},
        {"$set": update_doc}
    )
    
    return {"message": "Class updated successfully"}

@router.delete("/api/teacher/classes/{class_id}")
async def delete_teacher_class(
    class_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a teacher's class"""
    if current_user.get("role") != "Teacher":
        raise HTTPException(status_code=403, detail="Teacher access required")
    
    db = get_database()
    
    try:
        obj_id = ObjectId(class_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid class ID")
    
    # Verify ownership
    result = await db.teachers_timetable.delete_one({
        "_id": obj_id,
        "teacherId": current_user.get("userId")
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Class not found")
    
    return {"message": "Class deleted successfully"}
