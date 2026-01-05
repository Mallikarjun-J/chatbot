"""
Knowledge Base routes - Enhanced with ML-powered search and filtering
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from datetime import datetime
from ..middleware.auth import get_current_user
from ..database import get_database, map_documents

router = APIRouter()

@router.get("/api/knowledge-base")
async def get_knowledge_base(
    category: Optional[str] = None,
    content_type: Optional[str] = None,
    importance: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """
    Get knowledge base entries with advanced filtering
    
    Filters:
    - category: placements, events, examinations, holidays, documents, departments, admissions, facilities, academics, contact, research, clubs, achievements, timetable
    - content_type: page, document, circular, announcement, event, department, academic, placement, admission, result, timetable
    - importance: high, medium, low
    - search: text search in title and content
    """
    try:
        db = get_database()
        query_filter = {}
        
        # Apply filters
        if category:
            query_filter['category'] = category
        
        if content_type:
            query_filter['contentType'] = content_type
        
        if importance:
            query_filter['importance'] = importance
        
        # Text search
        if search:
            query_filter['$or'] = [
                {'pageTitle': {'$regex': search, '$options': 'i'}},
                {'summary': {'$regex': search, '$options': 'i'}},
                {'fullContent': {'$regex': search, '$options': 'i'}}
            ]
        
        # Get entries
        entries = await db.knowledge_base.find(query_filter)\
            .sort('updatedAt', -1)\
            .skip(skip)\
            .limit(limit)\
            .to_list(length=limit)
        
        entries = map_documents(entries)
        
        # Get total count
        total = await db.knowledge_base.count_documents(query_filter)
        
        return {
            'success': True,
            'entries': entries,
            'total': total,
            'page': skip // limit + 1,
            'pages': (total + limit - 1) // limit
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch knowledge base: {str(e)}")


@router.get("/api/knowledge-base/categories")
async def get_categories(
    current_user: dict = Depends(get_current_user)
):
    """Get all categories with counts"""
    try:
        db = get_database()
        
        # Aggregate by category
        pipeline = [
            {
                '$group': {
                    '_id': '$category',
                    'count': {'$sum': 1},
                    'importance': {'$first': '$importance'}
                }
            },
            {'$sort': {'count': -1}}
        ]
        
        categories = []
        async for doc in db.knowledge_base.aggregate(pipeline):
            categories.append({
                'category': doc['_id'],
                'count': doc['count'],
                'importance': doc.get('importance', 'low')
            })
        
        return {
            'success': True,
            'categories': categories
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch categories: {str(e)}")


@router.get("/api/knowledge-base/{entry_id}")
async def get_knowledge_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific knowledge base entry"""
    try:
        db = get_database()
        from bson import ObjectId
        
        entry = await db.knowledge_base.find_one({'_id': ObjectId(entry_id)})
        
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        entry = map_documents([entry])[0]
        
        return {
            'success': True,
            'entry': entry
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch entry: {str(e)}")


@router.delete("/api/knowledge-base/{entry_id}")
async def delete_knowledge_entry(
    entry_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a knowledge base entry (Admin only)"""
    if current_user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        db = get_database()
        from bson import ObjectId
        
        result = await db.knowledge_base.delete_one({'_id': ObjectId(entry_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        return {
            'success': True,
            'message': 'Entry deleted successfully'
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete entry: {str(e)}")


@router.get("/api/knowledge-base/stats/summary")
async def get_knowledge_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get knowledge base statistics"""
    try:
        db = get_database()
        
        # Get total counts
        total = await db.knowledge_base.count_documents({})
        
        # Get category breakdown
        category_pipeline = [
            {'$group': {'_id': '$category', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        
        categories = {}
        async for doc in db.knowledge_base.aggregate(category_pipeline):
            categories[doc['_id']] = doc['count']
        
        # Get importance breakdown
        importance_pipeline = [
            {'$group': {'_id': '$importance', 'count': {'$sum': 1}}}
        ]
        
        importance = {}
        async for doc in db.knowledge_base.aggregate(importance_pipeline):
            importance[doc['_id']] = doc['count']
        
        # Get content type breakdown
        type_pipeline = [
            {'$group': {'_id': '$contentType', 'count': {'$sum': 1}}},
            {'$sort': {'count': -1}}
        ]
        
        types = {}
        async for doc in db.knowledge_base.aggregate(type_pipeline):
            types[doc['_id']] = doc['count']
        
        # Get indexed count
        indexed_count = await db.knowledge_base.count_documents({'isIndexed': True})
        
        return {
            'success': True,
            'stats': {
                'total': total,
                'indexed': indexed_count,
                'categories': categories,
                'importance': importance,
                'contentTypes': types
            }
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")
