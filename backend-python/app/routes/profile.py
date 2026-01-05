"""
User profile routes - returns comprehensive user data for personalized chat
Updated: 2025-11-17
"""
from fastapi import APIRouter, Depends, HTTPException
from app.middleware.auth import get_current_user
from app.database import get_database
from loguru import logger

router = APIRouter()

@router.get("/api/user/profile")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    """
    Get comprehensive user profile data including:
    - Basic info (name, email, role, branch, semester, section)
    - Academic data (CGPA, SGPA)
    - Attendance data
    - Timetable
    - Recent announcements
    - Recent documents
    """
    try:
        db = get_database()
        user_role = current_user.get("role", "Student")
        user_email = current_user.get("email")
        user_branch = current_user.get("branch")
        user_semester = current_user.get("semester")
        user_section = current_user.get("section")
        
        logger.info(f"📋 Profile API called for: {user_email} | Role: {user_role} | Branch: {user_branch} | Semester: {user_semester} | Section: {user_section}")
        
        profile = {
            "basic": {
                "name": current_user.get("name"),
                "email": user_email,
                "role": user_role,
                "branch": user_branch,
                "semester": user_semester,
                "section": user_section
            }
        }
        
        # Get academic data (CGPA/SGPA)
        if user_role == "Student":
            cgpa_data = await db.cgpa.find_one({"email": user_email})
            if cgpa_data:
                profile["academic"] = {
                    "cgpa": cgpa_data.get("cgpa"),
                    "sgpa": cgpa_data.get("sgpa", {}),
                    "currentSemesterSGPA": cgpa_data.get("sgpa", {}).get(f"sem{user_semester}") if user_semester else None
                }
            
            # Get attendance data
            attendance_data = await db.attendance.find_one({"email": user_email})
            if attendance_data:
                profile["attendance"] = {
                    "overall": attendance_data.get("overallAttendance"),
                    "subjects": attendance_data.get("subjectWiseAttendance", [])
                }
            
            # Get student's timetable
            timetable_query = {
                "branch": user_branch,
                "section": user_section
            }
            if user_semester:
                timetable_query["semester"] = str(user_semester)
            
            logger.info(f"Querying timetable with: {timetable_query}")
            timetable = await db.student_timetables.find_one(timetable_query)
            logger.info(f"Timetable found: {timetable is not None}")
            if timetable:
                # Get schedule from 'days' field (new structure) or 'schedule' field (legacy)
                schedule_data = timetable.get("days", timetable.get("schedule", {}))
                
                profile["timetable"] = {
                    "id": str(timetable["_id"]),
                    "branch": timetable.get("branch"),
                    "section": timetable.get("section"),
                    "semester": timetable.get("semester"),
                    "schedule": schedule_data,
                    "uploadDate": timetable.get("uploadDate").isoformat() if timetable.get("uploadDate") else None,
                    "createdAt": timetable.get("createdAt").isoformat() if timetable.get("createdAt") else None
                }
                logger.info(f"Timetable schedule keys: {list(schedule_data.keys()) if isinstance(schedule_data, dict) else 'Not a dict'}")
        
        elif user_role == "Teacher":
            # Get teacher's personal teaching schedule (case-insensitive email match)
            logger.info(f"Fetching teacher timetable for: {user_email}")
            teacher_schedule = await db.teachers_timetable.find_one({
                "teacherEmail": {"$regex": f"^{user_email}$", "$options": "i"}
            })
            logger.info(f"Teacher schedule found: {teacher_schedule is not None}")
            
            if teacher_schedule:
                # The days field is already in the correct format (dict of day -> periods)
                days_dict = teacher_schedule.get("days", {})
                logger.info(f"Days data keys: {list(days_dict.keys()) if isinstance(days_dict, dict) else 'Not a dict'}")
                
                # Convert to schedule format expected by frontend/AI
                schedule_dict = {}
                for day_name, periods in days_dict.items():
                    if day_name and periods:
                        schedule_dict[day_name] = periods
                
                profile["timetable"] = {
                    "id": str(teacher_schedule["_id"]),
                    "teacherName": teacher_schedule.get("teacherName"),
                    "branch": teacher_schedule.get("branch"),
                    "schedule": schedule_dict,
                    "createdAt": teacher_schedule.get("createdAt").isoformat() if teacher_schedule.get("createdAt") else None
                }
                logger.info(f"Teacher timetable loaded with {len(schedule_dict)} days")

        
        # Get relevant announcements
        announcement_query = {
            "$or": [{"targetRole": "Both"}]
        }
        if user_role == "Student":
            announcement_query["$or"].append({"targetRole": "Students"})
        elif user_role == "Teacher":
            announcement_query["$or"].append({"targetRole": "Teachers"})
        
        announcements = await db.announcements.find(announcement_query).sort("date", -1).limit(5).to_list(length=5)
        profile["announcements"] = []
        for ann in announcements:
            # Filter by semester and branch for students
            if user_role == "Student":
                ann_semester = ann.get("semester")
                ann_branch = ann.get("branch")
                if ann_semester and str(ann_semester) != str(user_semester):
                    continue
                if ann_branch and ann_branch != user_branch:
                    continue
            # Filter by branch for teachers
            elif user_role == "Teacher":
                ann_branch = ann.get("branch")
                if ann_branch and ann_branch != user_branch:
                    continue
            
            profile["announcements"].append({
                "id": str(ann["_id"]),
                "title": ann.get("title"),
                "content": ann.get("content"),
                "date": ann.get("date").isoformat() if ann.get("date") else None
            })
        
        # Get relevant documents
        document_query = {}
        if user_role == "Student":
            document_query = {
                "$or": [
                    {"targetRole": "Both"},
                    {"targetRole": "Students"}
                ],
                "$or": [
                    {"semester": int(user_semester) if user_semester else None},
                    {"semester": None}
                ]
            }
            if user_branch:
                document_query["$or"].append({"branch": user_branch})
                document_query["$or"].append({"branch": None})
        elif user_role == "Teacher":
            document_query = {
                "$or": [
                    {"targetRole": "Both"},
                    {"targetRole": "Teachers"}
                ]
            }
            if user_branch:
                document_query["$or"].append({"branch": user_branch})
                document_query["$or"].append({"branch": None})
        
        documents = await db.documents.find(document_query).sort("uploadDate", -1).limit(5).to_list(length=5)
        profile["documents"] = [{
            "id": str(doc["_id"]),
            "name": doc.get("originalname"),
            "type": doc.get("documentType"),
            "subject": doc.get("subject"),
            "uploadDate": doc.get("uploadDate").isoformat() if doc.get("uploadDate") else None
        } for doc in documents]
        
        return profile
        
    except Exception as e:
        logger.error(f"Error fetching user profile: {e}")
        raise HTTPException(status_code=500, detail=str(e))
