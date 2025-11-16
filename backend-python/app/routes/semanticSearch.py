"""
Semantic Search and RAG API endpoints
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict

# Lazy imports to avoid blocking server startup
rag_service = None
vector_store = None

try:
    from app.services.ragService import rag_service as _rag
    from app.services.vectorStore import vector_store as _vs
    rag_service = _rag
    vector_store = _vs
except Exception as e:
    print(f"Warning: Semantic search services not available: {e}")

from app.middleware.auth import get_current_user

router = APIRouter()

class QueryRequest(BaseModel):
    question: str
    n_results: Optional[int] = 5

class QueryResponse(BaseModel):
    answer: str
    sources: List[Dict]
    retrieved_documents: List[str]
    confidence: str

@router.post("/api/semantic-search/query", response_model=QueryResponse)
async def semantic_query(
    request: QueryRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Natural language query on placement data using RAG
    
    Examples:
    - "Which branch has the highest placement percentage?"
    - "What is the average salary for CSE?"
    - "How many companies came for placements?"
    - "Show me the historical placement trend"
    - "What are the internship statistics?"
    """
    
    try:
        result = rag_service.query(request.question, request.n_results)
        return QueryResponse(**result)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")

@router.get("/api/semantic-search/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    """Get vector store statistics"""
    
    return {
        'total_documents': vector_store.get_collection_count(),
        'collection': 'placement_data',
        'embedding_model': 'all-MiniLM-L6-v2',
        'dimension': 384,
        'status': 'operational'
    }

@router.post("/api/semantic-search/search")
async def semantic_search(
    request: QueryRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Search for similar documents without LLM generation
    Returns raw similar documents based on semantic similarity
    
    This is faster than /query as it doesn't use LLM for generation
    """
    
    try:
        results = vector_store.search(request.question, request.n_results)
        return {
            'query': request.question,
            'results': results,
            'count': len(results['ids'])
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")

@router.get("/api/semantic-search/health")
async def health_check():
    """Check if semantic search system is operational"""
    
    try:
        count = vector_store.get_collection_count()
        return {
            'status': 'healthy',
            'vector_store': 'connected',
            'documents_indexed': count,
            'ready': count > 0
        }
    except Exception as e:
        return {
            'status': 'unhealthy',
            'error': str(e),
            'ready': False
        }
