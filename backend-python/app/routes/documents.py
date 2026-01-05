"""
Documents routes with AI-powered analysis
"""
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, status, Form
from fastapi.responses import FileResponse
from typing import List, Optional
from datetime import datetime
import os
import shutil
from bson import ObjectId
from loguru import logger

from app.middleware.auth import get_current_user
from app.database import get_database
from app.services.document_analyzer import DocumentAnalyzer
from app.services.email_service import email_service

router = APIRouter()
analyzer = DocumentAnalyzer()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {'.pdf', '.doc', '.docx', '.ppt', '.pptx'}

def allowed_file(filename: str) -> bool:
    return any(filename.lower().endswith(ext) for ext in ALLOWED_EXTENSIONS)

@router.get("/documents")
async def get_all_documents(current_user: dict = Depends(get_current_user)):
    """Get all documents"""
    try:
        db = get_database()
        documents = []
        cursor = db.documents.find().sort("uploadDate", -1)
        
        async for doc in cursor:
            documents.append({
                "id": str(doc["_id"]),
                "originalname": doc.get("originalname"),
                "filename": doc.get("filename"),
                "mimetype": doc.get("mimetype"),
                "size": doc.get("size"),
                "uploadDate": doc.get("uploadDate").isoformat() if doc.get("uploadDate") else None,
                "uploadedBy": doc.get("uploadedBy"),
                "documentType": doc.get("documentType"),
                "subject": doc.get("subject"),
                "semester": doc.get("semester"),
                "branch": doc.get("branch"),
                "topics": doc.get("topics", []),
                "keywords": doc.get("keywords", []),
                "description": doc.get("description"),
                "aiAnalyzed": doc.get("aiAnalyzed", False)
            })
        
        return documents
    except Exception as e:
        print(f"Error fetching documents: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch documents")

@router.post("/upload/document")
async def upload_document(
    file: UploadFile = File(...),
    documentType: str = Form(...),
    subject: str = Form(...),
    semester: str = Form(...),
    branch: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    targetRole: str = Form("Students"),  # "Students", "Teachers", or "Both"
    current_user: dict = Depends(get_current_user)
):
    """Upload document with admin-provided metadata"""
    file_path = None  # Initialize to avoid UnboundLocalError
    try:
        # Check permissions
        if current_user.get('role', '').lower() not in ['admin', 'teacher']:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins and teachers can upload documents"
            )
        
        # Validate file type
        if not allowed_file(file.filename):
            raise HTTPException(
                status_code=400,
                detail="Invalid file type. Only PDF, Word, and PowerPoint files are allowed"
            )
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"doc_{timestamp}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"📤 Uploading document: {file.filename}")
        print(f"📋 Type: {documentType} | Subject: {subject} | Semester: {semester} | TargetRole: {targetRole}")
        
        # Handle "all" semester - store as None in database but use for email filtering
        semester_value = None if not semester or semester.strip() == '' or semester.lower() == 'all' else int(semester)
        is_all_semesters = semester and semester.lower() == 'all'
        
        # Create document record with admin-provided data
        document_data = {
            "filename": unique_filename,
            "originalname": file.filename,
            "mimetype": file.content_type,
            "size": os.path.getsize(file_path),
            "uploadDate": datetime.now(),
            "uploadedBy": current_user.get('email', 'unknown'),
            "filePath": file_path,
            # Admin-provided metadata
            "documentType": documentType,
            "subject": subject,
            "semester": semester_value,
            "branch": branch,
            "description": description or '',
            "targetRole": targetRole,
            "topics": [],
            "keywords": [],
            "extractedText": '',
            "textLength": 0,
            "aiAnalyzed": False  # Marked as manually entered by admin
        }
        
        db = get_database()
        result = await db.documents.insert_one(document_data)
        
        # Remove MongoDB _id from response, use string id instead
        document_data.pop('_id', None)
        
        print(f"✅ Document uploaded successfully: {file.filename}")
        
        # Send email notifications based on targetRole
        logger.info("=" * 60)
        logger.info("📧 DOCUMENT EMAIL NOTIFICATION SYSTEM")
        logger.info("=" * 60)
        
        try:
            logger.info("🔍 Fetching recipients from database...")
            
            recipients = []
            
            if targetRole == "Students" or targetRole == "Both":
                # Build query filter for semester and optionally branch
                if is_all_semesters:
                    # Send to all students (optionally filtered by branch)
                    student_query = {"role": "Student"}
                    
                    if branch:
                        student_query["branch"] = {"$eq": branch}
                        logger.info(f"🎯 Filtering Students: ALL Semesters, Branch: {branch}")
                    else:
                        logger.info(f"🎯 Filtering Students: ALL Semesters, All Branches")
                        
                elif semester and semester.strip():
                    # Send to specific semester
                    student_query = {
                        "role": "Student",
                        "semester": {"$eq": str(semester)}  # Exact match for semester
                    }
                    
                    # If branch is specified, also filter by branch - EXACT MATCH
                    if branch:
                        student_query["branch"] = {"$eq": branch}  # Exact match for branch
                        logger.info(f"🎯 Filtering Students: Semester {semester}, Branch: {branch}")
                    else:
                        logger.info(f"🎯 Filtering Students: Semester {semester}, All Branches")
                else:
                    student_query = None
                    logger.info(f"⚠️  Skipping student notifications - no semester specified")
                
                if student_query:
                    logger.info(f"📝 Student Query: {student_query}")
                    
                    students = await db.users.find(student_query).to_list(length=None)
                    logger.info(f"👥 Found {len(students)} students")
                    recipients.extend(students)
            
            if targetRole == "Teachers" or targetRole == "Both":
                teacher_query = {"role": "Teacher"}
                
                # Filter by department (branch) if specified
                if branch:
                    teacher_query["branch"] = {"$eq": branch}
                    logger.info(f"🎯 Filtering Teachers: Department: {branch}")
                else:
                    logger.info(f"🎯 Filtering Teachers: All Departments")
                
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
                logger.info(f"📤 Sending document notification with attachment to: {', '.join(recipient_emails)}")
                logger.info(f"📎 Attaching file: {file_path}")
                
                # Prepare semester display for email
                semester_display = "All Semesters" if is_all_semesters else (int(semester) if semester and semester.strip() else None)
                
                email_result = await email_service.send_document_notification(
                    to_emails=recipient_emails,
                    document_name=file.filename,
                    document_type=documentType,
                    subject_name=subject,
                    semester=semester_display,
                    branch=branch,
                    description=description,
                    file_path=file_path
                )
                logger.info(f"✅ Email notifications with attachments: {email_result['sent']} sent, {email_result['failed']} failed")
                if email_result['failed'] > 0:
                    logger.warning(f"⚠️  Some emails failed to send")
            else:
                if targetRole == "Students":
                    logger.warning(f"⚠️  No students found" + (f" in Semester {semester}" if semester else "") + (f" with branch {branch}" if branch else ""))
                elif targetRole == "Teachers":
                    logger.warning(f"⚠️  No teachers found" + (f" in department {branch}" if branch else ""))
                else:
                    logger.warning(f"⚠️  No recipients found for the specified criteria")
                
        except Exception as e:
            logger.error(f"❌ Failed to send email notifications: {e}")
            logger.exception("Full error traceback:")
            # Don't fail the document upload if email fails
        
        logger.info("=" * 60)
        
        return {
            "message": "Document uploaded successfully",
            "document": {
                "id": str(result.inserted_id),
                "filename": document_data["filename"],
                "originalname": document_data["originalname"],
                "mimetype": document_data["mimetype"],
                "size": document_data["size"],
                "uploadDate": document_data["uploadDate"].isoformat(),
                "uploadedBy": document_data["uploadedBy"],
                "documentType": document_data["documentType"],
                "subject": document_data.get("subject"),
                "semester": document_data.get("semester"),
                "branch": document_data.get("branch"),
                "topics": document_data.get("topics", []),
                "keywords": document_data.get("keywords", []),
                "description": document_data.get("description", ""),
                "aiAnalyzed": document_data["aiAnalyzed"]
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        # Clean up file if database operation fails
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        print(f"Error uploading document: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")

@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download a document"""
    try:
        db = get_database()
        document = await db.documents.find_one({"_id": ObjectId(document_id)})
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        file_path = document.get("filePath")
        if not file_path or not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found on server")
        
        return FileResponse(
            path=file_path,
            filename=document.get("originalname"),
            media_type=document.get("mimetype")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error downloading document: {e}")
        raise HTTPException(status_code=500, detail="Failed to download document")

@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a document (Admin only)"""
    try:
        # Check if user is admin
        if current_user.get('role', '').lower() != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required"
            )
        
        db = get_database()
        document = await db.documents.find_one({"_id": ObjectId(document_id)})
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Delete file from filesystem
        file_path = document.get("filePath")
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        
        # Delete from database
        await db.documents.delete_one({"_id": ObjectId(document_id)})
        
        return {"message": "Document deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error deleting document: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete document")
