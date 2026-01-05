"""
AI Chat routes with ML/NLP integration
Hybrid chatbot using ML models + Gemini
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any
from loguru import logger

from app.middleware.auth import get_current_user
from app.ml.hybrid_chatbot import HybridChatbot
from app.utils import map_documents


router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    category: Optional[str] = None


class ChatResponse(BaseModel):
    content: str
    sources: list = []
    metadata: Dict[str, Any] = {}


class FeedbackRequest(BaseModel):
    message: str
    response: str
    feedback: str  # 'positive' or 'negative'
    category: Optional[str] = None


@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(
    request_data: ChatRequest,
    req: Request,
    current_user: Optional[dict] = None
):
    """
    Chat with ML/NLP-powered AI assistant
    
    Uses hybrid approach:
    - ML embeddings for semantic search
    - Trained classifier for content understanding
    - Google Gemini for natural language generation
    
    Admin users get full access to all users' data and information.
    """
    try:
        # Get ML services from app state
        embeddings = req.app.state.embeddings
        classifier = req.app.state.classifier
        
        # Create hybrid chatbot
        chatbot = HybridChatbot(embeddings=embeddings, classifier=classifier)
        
        # Fetch user data if logged in
        user_data = None
        user_name = None
        user_role = None
        
        if current_user:
            user_role = current_user["role"]
            user_name = current_user.get("name", "User")
            
            # Admin gets access to ALL data (no restrictions)
            if user_role == "Admin":
                try:
                    from app.database import db
                    
                    # Get all users data for admin
                    all_users = await db.users.find({}).to_list(length=None)
                    all_attendance = await db.attendance.find({}).to_list(length=None)
                    all_cgpa = await db.cgpa.find({}).to_list(length=None)
                    all_timetables = await db.timetables.find({}).to_list(length=None)
                    
                    # Convert MongoDB ObjectIds to strings
                    all_users = map_documents(all_users)
                    all_attendance = map_documents(all_attendance)
                    all_cgpa = map_documents(all_cgpa)
                    all_timetables = map_documents(all_timetables)
                    
                    logger.info(f"✅ Admin data fetched: {len(all_users)} users, {len(all_attendance)} attendance records")
                    
                    user_data = {
                        "role": "Admin",
                        "name": user_name,
                        "userId": current_user["userId"],
                        "allUsers": all_users,
                        "allAttendance": all_attendance,
                        "allCGPA": all_cgpa,
                        "allTimetables": all_timetables,
                        "hasFullAccess": True
                    }
                except Exception as e:
                    logger.error(f"❌ Could not fetch admin data: {e}")
                    import traceback
                    traceback.print_exc()
            
            # Fetch attendance data for students
            elif user_role == "Student":
                try:
                    from app.database import db
                    attendance_records = await db.attendance.find(
                        {"userId": current_user["userId"]}
                    ).to_list(length=None)
                    
                    user_data = {
                        "attendance": attendance_records,
                        "userId": current_user["userId"],
                        "name": user_name,
                        "role": user_role
                    }
                except Exception as e:
                    logger.warning(f"Could not fetch attendance data: {e}")
        
        # Generate response
        result = await chatbot.generate_response(
            message=request_data.message,
            category=request_data.category,
            user_role=user_role,
            user_name=user_name,
            user_data=user_data
        )
        
        return result
    
    except Exception as e:
        logger.error(f"Chat error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to process chat message"
        )


@router.post("/chat/feedback")
async def submit_feedback(
    feedback_data: FeedbackRequest,
    req: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Submit feedback on AI responses
    Used to improve ML models through active learning
    """
    try:
        # Get ML services
        embeddings = req.app.state.embeddings
        classifier = req.app.state.classifier
        
        # Create hybrid chatbot
        chatbot = HybridChatbot(embeddings=embeddings, classifier=classifier)
        
        # Train from conversation
        await chatbot.train_from_conversation(
            user_message=feedback_data.message,
            bot_response=feedback_data.response,
            user_feedback=feedback_data.feedback,
            category=feedback_data.category
        )
        
        return {
            "message": "Thank you for your feedback! This helps improve our AI.",
            "training_queued": True
        }
    
    except Exception as e:
        logger.error(f"Feedback error: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to process feedback"
        )


@router.post("/ml/retrain")
async def trigger_ml_retraining(
    req: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Trigger ML model retraining (Admin only)
    Uses accumulated conversation data and feedback
    """
    if current_user["role"] != "Admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    
    try:
        classifier = req.app.state.classifier
        
        # Auto-train from database
        await classifier.auto_train_from_db()
        
        return {
            "message": "ML model retraining completed successfully",
            "status": "success"
        }
    
    except Exception as e:
        logger.error(f"Retraining error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrain models: {str(e)}"
        )
