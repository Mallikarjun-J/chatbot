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
    """
    try:
        # Get ML services from app state
        embeddings = req.app.state.embeddings
        classifier = req.app.state.classifier
        
        # Create hybrid chatbot
        chatbot = HybridChatbot(embeddings=embeddings, classifier=classifier)
        
        # Generate response
        user_role = current_user["role"] if current_user else None
        result = await chatbot.generate_response(
            message=request_data.message,
            category=request_data.category,
            user_role=user_role
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
