"""
Hybrid AI Chatbot Service
Combines ML-trained models with Google Gemini for intelligent responses
"""

import google.generativeai as genai
from typing import List, Dict, Any, Optional
from loguru import logger

from app.config import settings
from app.database import db, map_documents
from app.ml.embeddings import EmbeddingService
from app.ml.content_classifier import ContentClassifier


class HybridChatbot:
    """
    Hybrid chatbot that uses:
    1. ML embeddings for semantic search in knowledge base
    2. Trained classifier for content understanding
    3. Google Gemini for natural language generation
    """
    
    def __init__(self, embeddings: EmbeddingService, classifier: ContentClassifier):
        self.embeddings = embeddings
        self.classifier = classifier
        
        # Configure Gemini
        genai.configure(api_key=settings.GEMINI_API_KEY)
        
        # Models to try (with fallbacks)
        self.models = [
            'gemini-2.0-flash-exp',
            'gemini-1.5-flash-latest',
            'gemini-1.5-pro-latest'
        ]
    
    async def build_knowledge_context(
        self,
        query: str,
        category: Optional[str] = None,
        use_ml_search: bool = True
    ) -> str:
        """
        Build knowledge base context for the chatbot
        Uses ML-powered semantic search and classification
        
        Args:
            query: User's query
            category: Optional category filter
            use_ml_search: Whether to use ML semantic search
            
        Returns:
            Formatted knowledge base string
        """
        knowledge_parts = []
        
        # 1. Get announcements from database
        announcements_filter = {}
        if category:
            announcements_filter['category'] = category
        
        announcements = await db.announcements.find(announcements_filter).sort('date', -1).limit(20).to_list(length=20)
        announcements = map_documents(announcements)
        
        if announcements:
            knowledge_parts.append("📢 Campus Announcements:\n")
            for idx, ann in enumerate(announcements[:10], 1):
                knowledge_parts.append(f"{idx}. {ann['title']}")
                knowledge_parts.append(f"   {ann['content']}")
                if ann.get('category'):
                    knowledge_parts.append(f"   Category: {ann['category']}")
                if ann.get('eventDate'):
                    knowledge_parts.append(f"   Date: {ann['eventDate']}")
                if ann.get('location'):
                    knowledge_parts.append(f"   Location: {ann['location']}")
                knowledge_parts.append("")
        
        # 2. Get placement data (high priority)
        placements = await db.placements.find({}).sort('date', -1).limit(10).to_list(length=10)
        placements = map_documents(placements)
        
        if placements:
            knowledge_parts.append("\n💼 Placement Information:\n")
            for idx, placement in enumerate(placements, 1):
                knowledge_parts.append(f"{idx}. {placement['title']}")
                knowledge_parts.append(f"   {placement['content']}")
                knowledge_parts.append("")
        
        # 3. Get events
        events = await db.events.find({}).sort('date', -1).limit(5).to_list(length=5)
        events = map_documents(events)
        
        if events:
            knowledge_parts.append("\n📅 Upcoming Events:\n")
            for idx, event in enumerate(events, 1):
                knowledge_parts.append(f"{idx}. {event['title']}")
                knowledge_parts.append(f"   {event['content']}")
                knowledge_parts.append("")
        
        # 4. ML-powered semantic search in knowledge base
        if use_ml_search and self.embeddings:
            try:
                # Get all knowledge base entries with embeddings
                kb_entries = await db.knowledge_base.find(
                    {'embeddings': {'$exists': True, '$ne': None}}
                ).to_list(length=100)
                
                if kb_entries:
                    # Perform semantic search
                    kb_entries = map_documents(kb_entries)
                    relevant_entries = await self.embeddings.semantic_search(
                        query=query,
                        documents=kb_entries,
                        top_k=5,
                        threshold=0.6
                    )
                    
                    if relevant_entries:
                        knowledge_parts.append("\n🔍 Relevant Information from Knowledge Base:\n")
                        for idx, entry in enumerate(relevant_entries, 1):
                            knowledge_parts.append(f"{idx}. {entry['pageTitle']} (Relevance: {entry['similarity_score']:.2f})")
                            knowledge_parts.append(f"   {entry['summary']}")
                            if entry.get('isPlacementData'):
                                knowledge_parts.append(f"   🎯 PLACEMENT DATA - HIGH PRIORITY")
                            knowledge_parts.append("")
            
            except Exception as e:
                logger.warning(f"ML semantic search failed: {e}")
        
        # 5. Classify the query to understand intent
        if self.classifier:
            try:
                classification = await self.classifier.classify(text=query)
                intent_category = classification['category']
                confidence = classification['confidence']
                
                # Add context about query intent
                knowledge_parts.append(f"\n🤔 Query Intent: {intent_category.upper()} (confidence: {confidence:.2f})\n")
                
            except Exception as e:
                logger.warning(f"Query classification failed: {e}")
        
        return "\n".join(knowledge_parts)
    
    async def generate_response(
        self,
        message: str,
        category: Optional[str] = None,
        user_role: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate AI response using hybrid approach
        
        Args:
            message: User's message
            category: Optional category filter
            user_role: User's role for personalized responses
            
        Returns:
            Dict with response content, sources, metadata
        """
        try:
            # Build knowledge context using ML
            knowledge = await self.build_knowledge_context(
                query=message,
                category=category,
                use_ml_search=True
            )
            
            # Create system prompt with ML-enhanced context
            system_prompt = f"""You are a helpful campus assistant for a college/university with ML-powered knowledge retrieval.

IMPORTANT INSTRUCTIONS:
1. Give SHORT and CONCISE answers (2-3 sentences maximum)
2. Only provide the most relevant information
3. Be direct and to the point
4. Prioritize PLACEMENT DATA when relevant

Your Knowledge Base (ML-Enhanced):
{knowledge}

Answer the student's question based ONLY on the information provided above. If the information is not available, politely say you don't have that information. Keep your response brief and focused.

User Role: {user_role or 'Guest'}
"""
            
            # Try Gemini models with fallback
            last_error = None
            for model_name in self.models:
                try:
                    logger.info(f"Using Gemini model: {model_name}")
                    
                    model = genai.GenerativeModel(
                        model_name=model_name,
                        generation_config={
                            "temperature": 0.7,
                            "max_output_tokens": 500,
                        },
                        system_instruction=system_prompt
                    )
                    
                    response = model.generate_content(message)
                    response_text = response.text
                    
                    logger.info(f"✅ Response generated with {model_name}")
                    
                    # Prepare metadata
                    metadata = {
                        "model": model_name,
                        "ml_enabled": True,
                        "semantic_search_used": True,
                        "classification_used": True
                    }
                    
                    return {
                        "content": response_text,
                        "sources": [],  # Could be populated with KB sources
                        "metadata": metadata
                    }
                
                except Exception as model_error:
                    logger.warning(f"Model {model_name} failed: {model_error}")
                    last_error = model_error
                    continue
            
            # All models failed
            raise Exception(f"All AI models failed. Last error: {last_error}")
        
        except Exception as e:
            logger.error(f"Hybrid chatbot error: {e}")
            return {
                "content": "I apologize, but I'm having trouble processing your request right now. Please try again later.",
                "sources": [],
                "metadata": {
                    "error": str(e),
                    "ml_enabled": False
                }
            }
    
    async def train_from_conversation(
        self,
        user_message: str,
        bot_response: str,
        user_feedback: Optional[str] = None,
        category: Optional[str] = None
    ):
        """
        Learn from conversations to improve ML models
        
        Args:
            user_message: User's message
            bot_response: Bot's response
            user_feedback: Optional user feedback (positive/negative)
            category: Optional category label
        """
        try:
            # If user provides explicit category or we can classify it
            if not category and self.classifier:
                classification = await self.classifier.classify(text=user_message)
                category = classification['category']
            
            # Store as training data
            training_entry = {
                'text': user_message,
                'label': category,
                'source': 'conversation',
                'confidence': 1.0 if user_feedback == 'positive' else 0.7,
                'createdAt': None  # Will be set by database
            }
            
            await db.ml_training_data.insert_one(training_entry)
            
            logger.info(f"Stored conversation for training: category={category}")
            
        except Exception as e:
            logger.error(f"Failed to store training data: {e}")
