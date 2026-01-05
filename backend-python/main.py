"""
FastAPI Backend with ML/NLP Integration
Main application entry point
"""

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import uvicorn
from loguru import logger
import sys

from app.config import settings
from app.database import connect_db, close_db, seed_database, create_indexes, get_database
# ML imports commented out until dependencies installed
# from app.ml.content_classifier import ContentClassifier
# from app.ml.embeddings import EmbeddingService

# Import routers
from app.routes import auth, users, announcements, timetables, teacher_timetables, teacher_classes, documents, scraping, file_upload, cgpa, attendance, profile, knowledge_base  # , semanticSearch


# Configure logging
logger.remove()
logger.add(
    sys.stdout,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan> - <level>{message}</level>",
    level="INFO"
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown"""
    # Startup
    logger.info("🚀 Starting CampusAura Python Backend with ML/NLP")
    
    # Connect to database
    await connect_db()
    logger.info("✅ MongoDB connected")
    
    # Create indexes
    await create_indexes()
    logger.info("✅ Database indexes created")
    
    # Seed database
    await seed_database()
    logger.info("✅ Database seeded")
    
    # Initialize ML models (commented out until ML dependencies installed)
    # logger.info("🤖 Loading ML models...")
    # try:
    #     app.state.classifier = ContentClassifier()
    #     await app.state.classifier.load_model()
    #     logger.info("✅ Content classifier loaded")
    #     
    #     app.state.embeddings = EmbeddingService()
    #     await app.state.embeddings.load_model()
    #     logger.info("✅ Embedding service loaded")
    # except Exception as e:
    #     logger.warning(f"⚠️ ML models not found: {e}")
    #     app.state.classifier = ContentClassifier()
    #     app.state.embeddings = EmbeddingService()
    
    logger.info(f"""
╔════════════════════════════════════════════╗
║   CampusAura Python Backend with ML/NLP    ║
║   Running on: http://{settings.HOST}:{settings.PORT}   ║
║   Environment: {settings.ENVIRONMENT}              ║
║   MongoDB: Connected                       ║
║   ML Models: Loaded                        ║
╚════════════════════════════════════════════╝
    """)
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down CampusAura Backend")
    await close_db()
    logger.info("✅ MongoDB connection closed")


# Create FastAPI app
app = FastAPI(
    title="CampusAura API",
    description="Campus Management System with ML/NLP-powered AI Assistant",
    version="2.0.0",
    lifespan=lifespan
)


# Security Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]  # Configure based on your needs
)


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception: {str(exc)}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Internal server error"}
    )


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT,
        "ml_loaded": hasattr(app.state, 'classifier') and hasattr(app.state, 'embeddings')
    }


# API Status endpoint
@app.get("/api/status")
async def api_status():
    """Show available and pending API endpoints"""
    return {
        "status": "running",
        "version": "1.0.0-minimal",
        "available_endpoints": {
            "auth": {
                "login": "POST /api/auth/login",
                "verify": "POST /api/auth/verify-token",
                "status": "✅ Available"
            },
            "chat": {
                "chat": "POST /api/chat",
                "status": "✅ Available (using Gemini API without ML)"
            },
            "announcements": {
                "get_all": "GET /api/announcements",
                "status": "⚠️ Returns empty array (needs implementation)"
            }
        },
        "pending_endpoints": {
            "announcements": "⚠️ Partial (GET only, needs POST/PUT/DELETE)",
            "users": "❌ Not yet implemented",
            "documents": "❌ Not yet implemented",
            "scraping": "❌ Not yet implemented",
            "timetables": "❌ Not yet implemented",
            "knowledge_base": "❌ Not yet implemented"
        },
        "note": "Chat endpoint now works without ML dependencies using Gemini API directly. For advanced ML features (semantic search, classification), install: numpy, torch, transformers, sentence-transformers",
        "docs": "/docs",
        "mongodb": "connected"
    }


# Simple chat endpoint using Gemini API directly (without ML dependencies)
@app.post("/api/chat")
async def simple_chat(request: Request):
    """Chat endpoint using Hybrid Chatbot with ML and knowledge base"""
    try:
        # Get message and context from request
        body = await request.json()
        user_message = body.get("message", "")
        context = body.get("context", {})
        
        # Extract user information
        user_role = context.get("role", "Guest")
        user_name = context.get("name", "Guest")
        user_data = context.get("data", {})  # Get the full user data including CGPA, attendance, etc.
        
        if not user_message:
            return JSONResponse(
                status_code=400,
                content={"error": "Message is required"}
            )
        
        # Use the hybrid chatbot
        from app.ml.hybrid_chatbot import HybridChatbot
        from app.ml.embeddings import EmbeddingService
        from app.ml.content_classifier import ContentClassifier
        
        # Create ML services and hybrid chatbot
        embeddings = EmbeddingService()
        classifier = ContentClassifier()
        chatbot = HybridChatbot(embeddings=embeddings, classifier=classifier)
        
        # Generate personalized response with full user context
        result = await chatbot.generate_response(
            message=user_message,
            category=None,
            user_role=user_role,
            user_name=user_name,
            user_data=user_data  # Pass the full user data
        )
        
        logger.info(f"✓ Generated response using {result['metadata'].get('model', 'unknown')}")
        
        return JSONResponse(content=result)
        
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "error": "Chat service error",
                "message": str(e),
                "fallback_response": "I'm having trouble processing your request. Please try again or contact support."
            }
        )


# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


# Include routers (only auth for now, others commented until implemented)
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, tags=["Users"])
app.include_router(announcements.router, tags=["Announcements"])
app.include_router(timetables.router, tags=["Student Timetables"])
app.include_router(teacher_timetables.router, tags=["Teacher Timetables"])
app.include_router(teacher_classes.router, tags=["Teacher Classes"])  # No prefix - routes already include /api
app.include_router(documents.router, prefix="/api", tags=["Documents"])
app.include_router(scraping.router, tags=["Web Scraping"])
app.include_router(file_upload.router, tags=["File Upload & Analysis"])
app.include_router(cgpa.router, tags=["CGPA"])
app.include_router(attendance.router, tags=["Attendance"])
app.include_router(profile.router, tags=["User Profile"])
app.include_router(knowledge_base.router, tags=["Knowledge Base"])
# app.include_router(semanticSearch.router, tags=["Semantic Search & RAG"])  # Disabled - use hybrid chatbot with RAG integration


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=False,  # Disabled reload to avoid import issues with ML packages
        log_level="info"
    )
