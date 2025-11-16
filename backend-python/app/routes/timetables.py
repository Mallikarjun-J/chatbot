"""
Timetables routes for managing class timetables
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from bson import ObjectId
from datetime import datetime
import os
import io
from PIL import Image
import pytesseract
import PyPDF2
import re

from ..database import get_database
from .auth import get_current_user
from ..config import settings

# Configure Tesseract path for Windows
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

router = APIRouter()

class TimeSlot(BaseModel):
    time: str
    subject: str
    teacher: Optional[str] = None
    room: Optional[str] = None

class ManualTimetableCreate(BaseModel):
    branch: str = Field(..., min_length=1)
    section: str = Field(..., min_length=1)
    semester: str = Field(..., min_length=1)
    days: Dict[str, List[TimeSlot]]

class TimetableConfirm(BaseModel):
    branch: str
    section: str
    semester: Optional[str] = None
    days: Dict[str, List[TimeSlot]]
    fileUrl: str

def extract_text_from_image(image_path: str) -> str:
    """Extract text from image using Tesseract OCR"""
    try:
        img = Image.open(image_path)
        text = pytesseract.image_to_string(img)
        return text
    except Exception as e:
        raise Exception(f"OCR extraction failed: {str(e)}")

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text from PDF"""
    try:
        text = ""
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page in pdf_reader.pages:
                text += page.extract_text()
        return text
    except Exception as e:
        raise Exception(f"PDF extraction failed: {str(e)}")

def parse_timetable_text(text: str) -> Dict[str, List[Dict[str, str]]]:
    """Parse extracted text to structure timetable data"""
    days = {
        "Monday": [],
        "Tuesday": [],
        "Wednesday": [],
        "Thursday": [],
        "Friday": [],
        "Saturday": []
    }
    
    lines = text.split('\n')
    current_day = None
    
    # Enhanced time patterns to handle OCR errors
    # Matches: 9:00-10:00, 9-10, 900-1000, 9.00-10.00, etc.
    time_patterns = [
        r'(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})',  # 9:00-10:00
        r'(\d{1,2})\.(\d{2})\s*-\s*(\d{1,2})\.(\d{2})',  # 9.00-10.00
        r'(\d{1,2}):?(\d{2})\s*-\s*(\d{1,2}):?(\d{2})',  # 900-1000 or 9:00-10:00
        r'(\d{1,2})\s*-\s*(\d{1,2})',  # 9-10 (simple format)
    ]
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Check if line contains a day
        for day in days.keys():
            # Check for day name with punctuation variations
            day_patterns = [
                day.lower(),
                day.lower() + '.',
                day.lower() + ',',
                day.lower() + ':'
            ]
            if any(pattern in line.lower() for pattern in day_patterns):
                current_day = day
                break
        
        # Try to extract time slots
        if current_day:
            time_match = None
            matched_pattern = None
            
            for pattern in time_patterns:
                time_match = re.search(pattern, line)
                if time_match:
                    matched_pattern = pattern
                    break
            
            if time_match:
                # Format time string properly
                groups = time_match.groups()
                if len(groups) == 4:
                    # Full format with minutes
                    start_hr, start_min, end_hr, end_min = groups
                    time_str = f"{start_hr}:{start_min}-{end_hr}:{end_min}"
                elif len(groups) == 2:
                    # Simple hour format
                    start_hr, end_hr = groups
                    time_str = f"{start_hr}:00-{end_hr}:00"
                else:
                    time_str = time_match.group(0)
                
                # Remove time from line to get subject/teacher/room
                remaining = line[time_match.end():].strip()
                
                # Try to split by common delimiters
                subject = ""
                teacher = ""
                room = ""
                
                # Look for patterns: Subject - Teacher - Room
                if '-' in remaining:
                    parts = [p.strip() for p in remaining.split('-')]
                    subject = parts[0] if len(parts) > 0 else ""
                    teacher = parts[1] if len(parts) > 1 else ""
                    room = parts[2] if len(parts) > 2 else ""
                else:
                    # Look for "Room XXX" pattern
                    room_match = re.search(r'[Rr]oom\s*(\d+)', remaining)
                    if room_match:
                        room = room_match.group(1)
                        remaining = remaining[:room_match.start()].strip()
                    
                    # Look for teacher names (Dr., Prof., etc.)
                    teacher_match = re.search(r'(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s*([A-Z][a-z]+)', remaining)
                    if teacher_match:
                        teacher = teacher_match.group(0)
                        remaining = remaining.replace(teacher, '').strip()
                    
                    subject = remaining if remaining else ""
                
                if subject or teacher:  # Only add if we have at least subject or teacher
                    days[current_day].append({
                        "time": time_str.strip(),
                        "subject": subject,
                        "teacher": teacher,
                        "room": room
                    })
    
    # Remove empty days
    return {day: slots for day, slots in days.items() if slots}

@router.post("/api/timetables/class/analyze")
async def analyze_timetable(
    timetable: UploadFile = File(...),
    branch: str = Form(...),
    section: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Analyze timetable file and extract schedule for preview (admin only)"""
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Validate file type
    allowed_types = ["application/pdf", "image/png", "image/jpeg", "image/jpg"]
    if timetable.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only PDF, PNG, and JPG files are allowed")
    
    # Save file temporarily
    file_ext = timetable.filename.split(".")[-1]
    filename = f"timetable_{branch.replace(' ', '_')}_{section}_{datetime.utcnow().timestamp()}.{file_ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    try:
        with open(file_path, "wb") as f:
            content = await timetable.read()
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Extract text based on file type
    try:
        if file_ext.lower() == 'pdf':
            extracted_text = extract_text_from_pdf(file_path)
        else:
            extracted_text = extract_text_from_image(file_path)
        
        # Parse the extracted text
        parsed_schedule = parse_timetable_text(extracted_text)
        
        return {
            "message": "Timetable analyzed successfully",
            "fileUrl": f"/uploads/{filename}",
            "fileName": timetable.filename,
            "extractedText": extracted_text[:500],  # First 500 chars for reference
            "schedule": parsed_schedule,
            "branch": branch,
            "section": section
        }
        
    except Exception as e:
        # Clean up file on error
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to analyze timetable: {str(e)}")

@router.post("/api/timetables/class/confirm")
async def confirm_timetable(
    timetable_data: TimetableConfirm,
    current_user: dict = Depends(get_current_user)
):
    """Save the confirmed timetable to database (admin only)"""
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Convert Pydantic models to dicts
    days_dict = {}
    for day, slots in timetable_data.days.items():
        days_dict[day] = [slot.dict() for slot in slots]
    
    timetable_doc = {
        "branch": timetable_data.branch,
        "section": timetable_data.section,
        "semester": timetable_data.semester,
        "days": days_dict,
        "fileUrl": timetable_data.fileUrl,
        "uploadedBy": current_user.get("userId"),
        "uploadedAt": datetime.utcnow(),
        "status": "active",
        "type": "uploaded"
    }
    
    # Check if timetable exists
    query = {"branch": timetable_data.branch, "section": timetable_data.section}
    if timetable_data.semester:
        query["semester"] = timetable_data.semester
    
    existing = await db.student_timetables.find_one(query)
    
    if existing:
        await db.student_timetables.update_one(query, {"$set": timetable_doc})
        timetable_id = str(existing["_id"])
    else:
        result = await db.student_timetables.insert_one(timetable_doc)
        timetable_id = str(result.inserted_id)
    
    return {
        "message": f"Timetable saved successfully for {timetable_data.branch} - Section {timetable_data.section}",
        "id": timetable_id
    }

@router.post("/api/timetables/class")
async def upload_class_timetable_legacy(
    timetable: UploadFile = File(...),
    branch: str = Form(...),
    section: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Legacy upload endpoint - redirects to analyze endpoint"""
    return await analyze_timetable(timetable, branch, section, current_user)

@router.post("/api/timetables/class/manual")
async def create_manual_timetable(
    timetable_data: ManualTimetableCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create student class timetable manually (admin only)"""
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    # Convert Pydantic models to dicts for MongoDB
    days_dict = {}
    for day, slots in timetable_data.days.items():
        days_dict[day] = [slot.dict() for slot in slots]
    
    timetable_doc = {
        "branch": timetable_data.branch,
        "section": timetable_data.section,
        "semester": timetable_data.semester,
        "days": days_dict,
        "createdBy": current_user.get("userId"),
        "createdAt": datetime.utcnow(),
        "status": "active",
        "type": "manual"
    }
    
    # Check if timetable exists
    existing = await db.student_timetables.find_one({
        "branch": timetable_data.branch,
        "section": timetable_data.section,
        "semester": timetable_data.semester
    })
    
    if existing:
        # Update existing
        await db.student_timetables.update_one(
            {
                "branch": timetable_data.branch,
                "section": timetable_data.section,
                "semester": timetable_data.semester
            },
            {"$set": timetable_doc}
        )
        timetable_id = str(existing["_id"])
    else:
        # Insert new
        result = await db.student_timetables.insert_one(timetable_doc)
        timetable_id = str(result.inserted_id)
    
    return {
        "message": f"Timetable created successfully for {timetable_data.branch} - Semester {timetable_data.semester}, Section {timetable_data.section}",
        "id": timetable_id,
        "branch": timetable_data.branch,
        "section": timetable_data.section,
        "semester": timetable_data.semester
    }

@router.get("/api/timetables/class")
async def get_class_timetables(current_user: dict = Depends(get_current_user)):
    """Get all student class timetables (admin only)"""
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    timetables = await db.student_timetables.find({}).sort("createdAt", -1).to_list(length=1000)
    
    for tt in timetables:
        tt["id"] = str(tt.pop("_id"))
        if "createdAt" in tt and tt["createdAt"]:
            tt["createdAt"] = tt["createdAt"].isoformat()
        if "uploadedAt" in tt and tt["uploadedAt"]:
            tt["uploadedAt"] = tt["uploadedAt"].isoformat()
    
    return timetables

@router.get("/api/timetables/class/{branch}/{section}")
async def get_timetable_by_class(
    branch: str,
    section: str,
    semester: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get timetable for specific branch, section, and optionally semester"""
    db = get_database()
    
    query = {"branch": branch, "section": section}
    if semester:
        query["semester"] = semester
    
    timetable = await db.student_timetables.find_one(query)
    
    if not timetable:
        raise HTTPException(status_code=404, detail="Timetable not found for this class")
    
    timetable["id"] = str(timetable.pop("_id"))
    if "createdAt" in timetable and timetable["createdAt"]:
        timetable["createdAt"] = timetable["createdAt"].isoformat()
    if "uploadedAt" in timetable and timetable["uploadedAt"]:
        timetable["uploadedAt"] = timetable["uploadedAt"].isoformat()
    
    return timetable

@router.get("/api/timetables/my-timetable")
async def get_my_timetable(current_user: dict = Depends(get_current_user)):
    """Get timetable for current student based on their branch, section, and semester"""
    if current_user.get("role") != "Student":
        raise HTTPException(status_code=403, detail="This endpoint is only for students")
    
    # Get student details
    branch = current_user.get("branch")
    section = current_user.get("section")
    semester = current_user.get("semester") or current_user.get("year")  # Try semester first, fallback to year
    
    if not branch or not section:
        raise HTTPException(
            status_code=400, 
            detail="Your profile is incomplete. Please contact admin to update your branch and section."
        )
    
    db = get_database()
    
    # Try to find timetable with semester first
    query = {"branch": branch, "section": section}
    if semester:
        query["semester"] = str(semester)
    
    timetable = await db.student_timetables.find_one(query)
    
    # If not found with semester, try without semester
    if not timetable and semester:
        timetable = await db.student_timetables.find_one({"branch": branch, "section": section})
    
    if not timetable:
        raise HTTPException(
            status_code=404, 
            detail=f"No timetable found for {branch}, Section {section}" + (f", Semester {semester}" if semester else "")
        )
    
    timetable["id"] = str(timetable.pop("_id"))
    if "createdAt" in timetable and timetable["createdAt"]:
        timetable["createdAt"] = timetable["createdAt"].isoformat()
    if "uploadedAt" in timetable and timetable["uploadedAt"]:
        timetable["uploadedAt"] = timetable["uploadedAt"].isoformat()
    
    return timetable

@router.delete("/api/timetables/class/{timetable_id}")
async def delete_timetable(
    timetable_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete student class timetable (admin only)"""
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    db = get_database()
    
    try:
        object_id = ObjectId(timetable_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid timetable ID")
    
    # Get timetable to delete associated file
    timetable = await db.student_timetables.find_one({"_id": object_id})
    
    if not timetable:
        raise HTTPException(status_code=404, detail="Timetable not found")
    
    # Delete file if exists
    if "fileUrl" in timetable:
        file_path = os.path.join(settings.UPLOAD_DIR, os.path.basename(timetable["fileUrl"]))
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except:
                pass  # Continue even if file deletion fails
    
    # Delete from database
    result = await db.student_timetables.delete_one({"_id": object_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Timetable not found")
    
    return {"message": "Timetable deleted successfully"}


@router.get("/api/timetables/teacher/my-timetable")
async def get_teacher_timetable(
    current_user: dict = Depends(get_current_user)
):
    """Get teacher's personal timetable from teachers_timetable collection"""
    if current_user.get("role") != "Teacher":
        raise HTTPException(
            status_code=403, 
            detail="Only teachers can access this endpoint"
        )
    
    db = get_database()
    teacher_email = current_user.get("email")
    teacher_id = str(current_user.get("_id"))
    teacher_name = current_user.get("name")
    
    # Try to find timetable by email, teacherId, or name (case-insensitive)
    timetable = await db.teachers_timetable.find_one({
        "$or": [
            {"teacherEmail": {"$regex": f"^{teacher_email}$", "$options": "i"}},
            {"teacherId": teacher_id},
            {"teacherName": {"$regex": f"^{teacher_name}$", "$options": "i"}}
        ]
    })
    
    if not timetable:
        raise HTTPException(
            status_code=404,
            detail="Your timetable hasn't been uploaded yet. Please check back later or contact your admin."
        )
    
    # Format response
    return {
        "id": str(timetable["_id"]),
        "teacherName": timetable.get("teacherName", current_user.get("name")),
        "department": timetable.get("department", ""),
        "subject": timetable.get("subject", ""),
        "days": timetable.get("days", {}),
        "uploadedAt": timetable.get("createdAt")
    }


@router.post("/api/timetables/teacher/my-timetable")
async def create_teacher_timetable(
    timetable_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Create teacher's personal timetable"""
    if current_user.get("role") != "Teacher":
        raise HTTPException(
            status_code=403, 
            detail="Only teachers can create timetables"
        )
    
    db = get_database()
    teacher_email = current_user.get("email")
    teacher_id = str(current_user.get("_id"))
    
    # Check if timetable already exists
    existing = await db.teachers_timetable.find_one({"teacherEmail": teacher_email})
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Timetable already exists. Use PUT to update."
        )
    
    # Create new timetable
    new_timetable = {
        "teacherId": teacher_id,
        "teacherEmail": teacher_email,
        "teacherName": current_user.get("name"),
        "department": current_user.get("department", ""),
        "days": timetable_data.get("days", {}),
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow()
    }
    
    result = await db.teachers_timetable.insert_one(new_timetable)
    
    return {
        "id": str(result.inserted_id),
        "message": "Timetable created successfully"
    }


@router.put("/api/timetables/teacher/my-timetable/{timetable_id}")
async def update_teacher_timetable(
    timetable_id: str,
    timetable_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update teacher's personal timetable"""
    if current_user.get("role") != "Teacher":
        raise HTTPException(
            status_code=403, 
            detail="Only teachers can update timetables"
        )
    
    db = get_database()
    teacher_email = current_user.get("email")
    
    try:
        object_id = ObjectId(timetable_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid timetable ID")
    
    # Verify ownership
    existing = await db.teachers_timetable.find_one({"_id": object_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Timetable not found")
    
    if existing.get("teacherEmail") != teacher_email:
        raise HTTPException(status_code=403, detail="Not authorized to update this timetable")
    
    # Update timetable
    update_data = {
        "days": timetable_data.get("days", existing.get("days", {})),
        "updatedAt": datetime.utcnow()
    }
    
    await db.teachers_timetable.update_one(
        {"_id": object_id},
        {"$set": update_data}
    )
    
    return {
        "id": str(object_id),
        "message": "Timetable updated successfully"
    }


@router.get("/api/timetables/teacher/my-schedule")
async def get_teacher_schedule(
    current_user: dict = Depends(get_current_user)
):
    """Get teacher's teaching schedule across all classes they teach"""
    if current_user.get("role") != "Teacher":
        raise HTTPException(
            status_code=403, 
            detail="Only teachers can access teaching schedules"
        )
    
    db = get_database()
    teacher_email = current_user.get("email")
    teacher_name = current_user.get("name")
    
    # Find all timetables where this teacher is teaching
    timetables = await db.student_timetables.find({}).to_list(length=None)
    
    # Aggregate teacher's classes from all timetables
    teacher_schedules = []
    
    for timetable in timetables:
        days_dict = timetable.get("days", {})
        teacher_days = {}
        has_classes = False
        
        # Check each day for classes taught by this teacher
        for day, slots in days_dict.items():
            teacher_slots = []
            for slot in slots:
                # Match by teacher name or email
                if (slot.get("teacher", "").lower() == teacher_name.lower() or 
                    slot.get("teacherEmail", "").lower() == teacher_email.lower()):
                    # Add class details
                    teacher_slot = {
                        "time": slot.get("time", ""),
                        "subject": slot.get("subject", ""),
                        "branch": timetable.get("branch", ""),
                        "section": timetable.get("section", ""),
                        "semester": timetable.get("semester", ""),
                        "room": slot.get("room", "")
                    }
                    teacher_slots.append(teacher_slot)
                    has_classes = True
            
            if teacher_slots:
                teacher_days[day] = teacher_slots
        
        if has_classes:
            teacher_schedules.append({
                "id": str(timetable["_id"]),
                "teacherName": teacher_name,
                "subject": timetable.get("subject", "Multiple Subjects"),
                "days": teacher_days,
                "uploadedAt": timetable.get("createdAt")
            })
    
    if not teacher_schedules:
        raise HTTPException(
            status_code=404,
            detail="No teaching schedule found. Please contact admin to assign classes."
        )
    
    # If teacher teaches multiple classes, return all schedules
    # If only one, return it directly
    return teacher_schedules if len(teacher_schedules) > 1 else teacher_schedules[0] if teacher_schedules else []
