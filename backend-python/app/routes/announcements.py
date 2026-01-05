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
from datetime import datetime, timedelta
from loguru import logger

from ..database import get_database
from .auth import get_current_user
from ..services.email_service import email_service

router = APIRouter()

class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    eventDate: Optional[str] = None
    eventTime: Optional[str] = None
    location: Optional[str] = None
    targetRole: str = Field(default="Students")  # "Students", "Teachers", or "Both"
    semester: Optional[str] = None  # Target semester (optional, all if not specified, N/A for Teachers)
    branch: Optional[str] = None    # Target branch/department (optional, all if not specified)

class AnnouncementUpdate(BaseModel):
    title: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)
    eventDate: Optional[str] = None
    eventTime: Optional[str] = None
    location: Optional[str] = None
    targetRole: str = Field(default="Students")
    semester: Optional[str] = None
    branch: Optional[str] = None

@router.get("/api/announcements/public")
async def get_public_announcements():
    """Get public announcements (no authentication required) - only 'Both' targetRole from last 7 days"""
    db = get_database()
    
    # Filter announcements to only show those from the last 7 days with targetRole="Both"
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    query_filter = {
        "date": {"$gte": seven_days_ago},
        "targetRole": "Both"  # Only show announcements marked for both students and teachers
    }
    
    # Fetch announcements
    announcements = await db.announcements.find(query_filter).sort("date", -1).to_list(length=100)
    
    # Convert ObjectId to string
    for ann in announcements:
        ann["id"] = str(ann.pop("_id"))
        if "date" in ann and ann["date"]:
            ann["date"] = ann["date"].isoformat()
    
    return announcements

@router.get("/api/announcements")
async def get_announcements(current_user: dict = Depends(get_current_user)):
    """Get announcements filtered by user role"""
    db = get_database()
    
    # Get user's role
    user_role = current_user.get("role", "Student")
    user_semester = current_user.get("semester")
    user_branch = current_user.get("branch")
    
    # Filter announcements to only show those from the last 7 days
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    
    # Build filter query based on targetRole and date
    if user_role == "Admin":
        # Admin sees all announcements from last 7 days
        query_filter = {
            "date": {"$gte": seven_days_ago}
        }
    else:
        query_filter = {
            "date": {"$gte": seven_days_ago},
            "$or": [
                {"targetRole": "Both"},  # Announcements for both students and teachers
            ]
        }
        
        # Add role-specific filters
        if user_role == "Student":
            query_filter["$or"].append({"targetRole": "Students"})
        elif user_role == "Teacher":
            query_filter["$or"].append({"targetRole": "Teachers"})
    
    # Fetch all announcements matching the role filter
    announcements = await db.announcements.find(query_filter).sort("date", -1).to_list(length=1000)
    
    # Further filter announcements based on semester and branch
    filtered_announcements = []
    for ann in announcements:
        target_role = ann.get("targetRole", "Students")  # Default to Students if not set
        ann_semester = ann.get("semester")
        ann_branch = ann.get("branch")
        
        logger.debug(f"🔍 Processing: '{ann.get('title')}' | targetRole={target_role} | branch={ann_branch} | semester={ann_semester}")
        
        # Check if announcement matches user's semester and branch
        include_announcement = False
        
        # Admin sees everything
        if user_role == "Admin":
            include_announcement = True
            logger.debug(f"   Admin: TRUE")
        elif target_role == "Both":
            # For "Both", check role-specific criteria
            if user_role == "Student":
                # Check semester and branch for students
                semester_match = not ann_semester or str(ann_semester) == str(user_semester)
                branch_match = not ann_branch or ann_branch == user_branch
                include_announcement = semester_match and branch_match
                logger.debug(f"   Both→Student: sem={semester_match}, branch={branch_match} → {include_announcement}")
            elif user_role == "Teacher":
                # Check branch/department for teachers (no semester check)
                branch_match = not ann_branch or ann_branch == user_branch
                include_announcement = branch_match
                logger.debug(f"   Both→Teacher: branch={branch_match} → {include_announcement}")
            else:
                include_announcement = True  # Admin sees all
                logger.debug(f"   Both→Admin: TRUE")
                
        elif target_role == "Students":
            # Only show to students
            if user_role == "Student":
                semester_match = not ann_semester or str(ann_semester) == str(user_semester)
                branch_match = not ann_branch or ann_branch == user_branch
                include_announcement = semester_match and branch_match
                logger.debug(f"   Students→Student: sem={semester_match}, branch={branch_match} → {include_announcement}")
            else:
                logger.debug(f"   Students but user is {user_role} → FALSE")
            
        elif target_role == "Teachers":
            # Only show to teachers
            if user_role == "Teacher":
                branch_match = not ann_branch or ann_branch == user_branch
                include_announcement = branch_match
                logger.debug(f"   Teachers→Teacher: branch={branch_match} → {include_announcement}")
            else:
                logger.debug(f"   Teachers but user is {user_role} → FALSE")
        
        if include_announcement:
            logger.debug(f"   ✅ INCLUDED")
            # Convert ObjectId to string
            ann["id"] = str(ann.pop("_id"))
            if "date" in ann and ann["date"]:
                ann["date"] = ann["date"].isoformat()
            filtered_announcements.append(ann)
        else:
            logger.debug(f"   ❌ EXCLUDED")
    
    return filtered_announcements

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
        "createdBy": current_user.get("userId"),
        "targetRole": announcement.targetRole or "Students"  # Add targetRole to database
    }
    
    if announcement.eventDate:
        new_announcement["eventDate"] = announcement.eventDate
    if announcement.eventTime:
        new_announcement["eventTime"] = announcement.eventTime
    if announcement.location:
        new_announcement["location"] = announcement.location
    if announcement.semester:
        new_announcement["semester"] = announcement.semester
    if announcement.branch:
        new_announcement["branch"] = announcement.branch
    
    result = await db.announcements.insert_one(new_announcement)
    new_announcement["id"] = str(result.inserted_id)
    new_announcement.pop("_id", None)
    new_announcement["date"] = new_announcement["date"].isoformat()
    
    # Send email notifications to all students
    logger.info("=" * 60)
    logger.info("📧 ANNOUNCEMENT EMAIL NOTIFICATION SYSTEM")
    logger.info("=" * 60)
    
    try:
        logger.info("🔍 Fetching recipients from database...")
        
        # Build query filter based on targetRole
        target_role = announcement.targetRole or "Students"
        recipients = []
        
        if target_role == "Students" or target_role == "Both":
            student_query = {"role": "Student"}
            
            # Filter by semester if specified - ONLY for students
            if announcement.semester:
                student_query["semester"] = {"$eq": str(announcement.semester)}
            
            # Filter by branch if specified
            if announcement.branch:
                student_query["branch"] = {"$eq": announcement.branch}
            
            logger.info(f"📝 Student Query: {student_query}")
            students = await db.users.find(student_query).to_list(length=None)
            logger.info(f"👥 Found {len(students)} students")
            recipients.extend(students)
        
        if target_role == "Teachers" or target_role == "Both":
            teacher_query = {"role": "Teacher"}
            
            # Filter by department (branch) if specified
            if announcement.branch:
                teacher_query["branch"] = {"$eq": announcement.branch}
            
            logger.info(f"📝 Teacher Query: {teacher_query}")
            teachers = await db.users.find(teacher_query).to_list(length=None)
            logger.info(f"👥 Found {len(teachers)} teachers")
            recipients.extend(teachers)
        
        logger.info(f"📧 Total Recipients: {len(recipients)}")
        
        # Log details of ALL found recipients for debugging
        if recipients:
            logger.info(f"📋 Matched recipient details:")
            for recipient in recipients:
                role = recipient.get('role', 'Unknown')
                name = recipient.get('name')
                email = recipient.get('email')
                if role == 'Student':
                    logger.info(f"   - [Student] {name} | Semester: '{recipient.get('semester')}' | Branch: '{recipient.get('branch')}' | Email: {email}")
                else:
                    logger.info(f"   - [Teacher] {name} | Department: '{recipient.get('branch')}' | Email: {email}")
        
        recipient_emails = [r.get("email") for r in recipients if r.get("email")]
        logger.info(f"📧 Recipients with valid emails: {len(recipient_emails)}")
        
        if recipient_emails:
            logger.info(f"📤 Sending announcement notification to: {', '.join(recipient_emails)}")
            email_result = await email_service.send_announcement_notification(
                to_emails=recipient_emails,
                announcement_title=announcement.title,
                announcement_content=announcement.content,
                event_date=announcement.eventDate,
                event_time=announcement.eventTime,
                location=announcement.location
            )
            logger.info(f"✅ Email notifications: {email_result['sent']} sent, {email_result['failed']} failed")
            if email_result['failed'] > 0:
                logger.warning(f"⚠️  Some emails failed to send")
        else:
            logger.warning("⚠️  No recipients with email addresses found")
            
    except Exception as e:
        logger.error(f"❌ Failed to send email notifications: {e}")
        logger.exception("Full error traceback:")
        # Don't fail the announcement creation if email fails
    
    logger.info("=" * 60)
    
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
    
    # Update targetRole if provided
    if announcement.targetRole:
        update_data["targetRole"] = announcement.targetRole
    
    # Update semester and branch if provided
    if announcement.semester is not None:
        update_data["semester"] = announcement.semester
    if announcement.branch:
        update_data["branch"] = announcement.branch
    
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
