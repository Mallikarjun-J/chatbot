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
from app.routes import auth, users, announcements, timetables, teacher_timetables, teacher_classes, documents, scraping, file_upload  # , semanticSearch, knowledge_base


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
    """Simple chat endpoint using Gemini API with RAG for placement queries"""
    try:
        import google.generativeai as genai
        
        # Get message from request
        body = await request.json()
        user_message = body.get("message", "")
        
        logger.info(f"Received chat message: {user_message}")
        
        if not user_message:
            return JSONResponse(
                status_code=400,
                content={"error": "Message is required"}
            )
        
        # Check if this is a placement-related query - use RAG if so
        placement_keywords = ['placement', 'placed', 'package', 'salary', 'company', 'companies', 
                             'ctc', 'offer', 'recruit', 'hiring', 'job', 'career', '2025', 'batch']
        
        is_placement_query = any(keyword in user_message.lower() for keyword in placement_keywords)
        
        if is_placement_query:
            logger.info("🎯 Detected placement query - using RAG service")
            try:
                # Import RAG service (lazy import)
                from app.services.ragService import rag_service
                
                # Use RAG service for placement queries
                rag_result = rag_service.query(user_message, n_results=5)
                
                if rag_result['confidence'] != 'low':
                    answer_text = rag_result['answer']
                    logger.info(f"✅ RAG returned answer with {rag_result['confidence']} confidence")
                    logger.info(f"📝 Answer length: {len(answer_text)} chars")
                    logger.info(f"📝 Answer preview: {answer_text[:100]}...")
                    return JSONResponse(content={
                        "content": answer_text,  # Frontend expects 'content' not 'response'
                        "response": answer_text,  # Keep for compatibility
                        "model": "RAG with Gemini 2.5 Flash",
                        "rag_used": True,
                        "confidence": rag_result['confidence'],
                        "sources": rag_result.get('sources', []),
                        "sources_count": len(rag_result.get('sources', []))
                    })
                else:
                    logger.warning("RAG confidence low, falling back to simple chat")
            except Exception as rag_error:
                logger.warning(f"RAG service failed, falling back to simple chat: {rag_error}")
        
        # Configure Gemini API
        genai.configure(api_key=settings.GEMINI_API_KEY)
        
        # Try models in order of preference (with fallback)
        models_to_try = [
            'gemini-2.5-flash',  # Primary: Your available quota
            'gemini-1.5-flash',  # Fallback 1
            'gemini-2.0-flash-exp',  # Fallback 2: Experimental
            'gemini-pro'  # Final fallback
        ]
        
        model = None
        model_used = None
        last_error = None
        
        for model_name in models_to_try:
            try:
                model = genai.GenerativeModel(model_name)
                model_used = model_name
                logger.info(f"✓ Using Gemini model: {model_name}")
                break
            except Exception as e:
                last_error = str(e)
                logger.warning(f"✗ Model {model_name} unavailable: {e}")
                continue
        
        if not model:
            raise Exception(f"No Gemini models available. Last error: {last_error}")
        
        # Get database connection
        db = get_database()
        
        # Build context from database
        context_parts = []
        
        # Get recent announcements
        recent_announcements = await db.announcements.find().sort("createdAt", -1).limit(5).to_list(length=5)
        if recent_announcements:
            context_parts.append("Recent Announcements:")
            for ann in recent_announcements:
                context_parts.append(f"- {ann.get('title', '')}: {ann.get('content', '')}")
        
        # Get recent placements
        recent_placements = await db.placements.find().sort("date", -1).limit(3).to_list(length=3)
        if recent_placements:
            context_parts.append("\nRecent Placements:")
            for pl in recent_placements:
                context_parts.append(f"- {pl.get('company', '')}: {pl.get('package', '')} LPA")
        
        # Get upcoming events
        from datetime import datetime
        upcoming_events = await db.events.find({"date": {"$gte": datetime.utcnow()}}).sort("date", 1).limit(3).to_list(length=3)
        if upcoming_events:
            context_parts.append("\nUpcoming Events:")
            for evt in upcoming_events:
                context_parts.append(f"- {evt.get('title', '')}: {evt.get('date', '')}")
        
        # Build full prompt
        context = "\n".join(context_parts) if context_parts else "No campus data available yet."
        
        # Detect if this is a general college life question
        general_keywords = ['college life', 'campus culture', 'student life', 'how is', 'what is it like', 
                           'tell me about', 'describe', 'experience', 'activities', 'clubs', 'hostel', 
                           'library', 'cafeteria', 'sports', 'facilities', 'infrastructure']
        is_general_question = any(keyword in user_message.lower() for keyword in general_keywords)
        
        if is_general_question:
            college_name = settings.COLLEGE_NAME
            college_location = settings.COLLEGE_LOCATION
            full_prompt = f"""You are CampusAura AI, a helpful assistant for {college_name} students.

The student is asking a general question about college life, campus culture, or experiences at {college_name}.

College Information:
- College Name: {college_name}
- Location: {college_location}

Campus Context (if available):
{context}

Student Question: {user_message}

IMPORTANT: When answering about college life, campus culture, facilities, or experiences, provide information specifically about {college_name} in {college_location}. Use your knowledge about this specific college to give accurate insights. If you need to search for information, focus on {college_name}. If our campus data has relevant information, include it. Provide helpful guidance about this college's student life, activities, facilities, and what students can expect at {college_name}."""
        else:
            full_prompt = f"""You are CampusAura AI, a helpful assistant for a college campus management system.

Campus Context:
{context}

Student Question: {user_message}

Provide a helpful, concise response based on the campus context above. If the information isn't in the context, provide general guidance."""
        
        logger.info(f"Sending prompt to {model_used}...")
        
        # Generate response
        response = model.generate_content(full_prompt)
        
        logger.info(f"Raw response type: {type(response)}")
        logger.info(f"Response attributes: {dir(response)}")
        
        response_text = ""
        finish_reason = None
        safety_block_reason = None
        prompt_feedback = None
        
        if hasattr(response, 'prompt_feedback') and response.prompt_feedback:
            prompt_feedback = response.prompt_feedback
            safety_block_reason = getattr(prompt_feedback, 'block_reason', None)
            logger.info(f"Prompt feedback: {prompt_feedback}")
        
        # Preferred extraction order: candidates -> text -> parts
        try:
            if hasattr(response, 'candidates') and response.candidates:
                for candidate in response.candidates:
                    if getattr(candidate, 'finish_reason', None) and not finish_reason:
                        finish_reason = candidate.finish_reason
                    if getattr(candidate, 'content', None) and getattr(candidate.content, 'parts', None):
                        candidate_text = ''.join(
                            part.text for part in candidate.content.parts if hasattr(part, 'text') and part.text
                        )
                        if candidate_text and candidate_text.strip():
                            response_text = candidate_text.strip()
                            logger.info(f"Got response via candidate parts (finish_reason={finish_reason})")
                            break
            if (not response_text) and hasattr(response, 'text') and response.text:
                response_text = response.text.strip()
                logger.info(f"Got response via .text: length={len(response_text)}")
            if (not response_text) and hasattr(response, 'parts'):
                response_text = ''.join(part.text for part in response.parts if hasattr(part, 'text') and part.text).strip()
                if response_text:
                    logger.info(f"Got response via .parts: length={len(response_text)}")
        except Exception as parse_err:
            logger.warning(f"Failed to parse Gemini response: {parse_err}")
        
        # Fallback if still empty
        if not response_text or not response_text.strip():
            logger.warning(
                f"⚠️ Empty response from Gemini. finish_reason={finish_reason}, block_reason={safety_block_reason}, response={response}"
            )
            if safety_block_reason:
                response_text = (
                    "Gemini could not answer this question because it was flagged by safety filters. "
                    "Please rephrase and try again."
                )
            else:
                response_text = (
                    "I received your message but couldn't generate a response. Please try rephrasing your question or try again."
                )
        else:
            logger.info(f"✓ Successfully generated response (finish_reason={finish_reason}): {response_text[:100]}...")
        
        knowledge_stats = {
            "announcementsUsed": len(recent_announcements) if 'recent_announcements' in locals() else 0,
            "placementsFound": len(recent_placements) if 'recent_placements' in locals() else 0,
            "eventsFound": len(upcoming_events) if 'upcoming_events' in locals() else 0,
            "liveDataFetched": False  # set to True once scraping/live data is wired
        }

        source_entries = []
        if knowledge_stats["announcementsUsed"]:
            source_entries.append({
                "type": "announcements",
                "count": knowledge_stats["announcementsUsed"],
                "latest": recent_announcements[0].get("title") if recent_announcements else None
            })
        if knowledge_stats["placementsFound"]:
            source_entries.append({
                "type": "placements",
                "count": knowledge_stats["placementsFound"]
            })
        if knowledge_stats["eventsFound"]:
            source_entries.append({
                "type": "events",
                "count": knowledge_stats["eventsFound"]
            })
        if not source_entries:
            source_entries.append({"type": "gemini", "count": 1})

        return {
            "response": response_text,
            "content": response_text,  # frontend expects `content`
            "model": model_used,
            "sources": source_entries,
            "knowledgeBase": knowledge_stats,
            "metadata": {
                "model": model_used,
                "has_context": len(context_parts) > 0,
                "finish_reason": finish_reason or safety_block_reason,
                "safety_block_reason": safety_block_reason,
                "prompt_feedback": str(prompt_feedback) if prompt_feedback else None
            }
        }
        
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
app.include_router(teacher_classes.router, tags=["Teacher Classes"])
app.include_router(documents.router, prefix="/api", tags=["Documents"])
app.include_router(scraping.router, tags=["Web Scraping"])
app.include_router(file_upload.router, tags=["File Upload & Analysis"])
# app.include_router(semanticSearch.router, tags=["Semantic Search & RAG"])  # Disabled - use hybrid chatbot with RAG integration
# app.include_router(knowledge_base.router, prefix="/api/knowledge-base", tags=["Knowledge Base"])


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=False,  # Disabled reload to avoid import issues with ML packages
        log_level="info"
    )
