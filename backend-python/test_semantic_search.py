"""
Quick test script for Semantic Search & RAG
Tests the system without starting the full server
"""

import asyncio
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from app.services.vectorStore import vector_store
from app.services.ragService import rag_service

async def test_semantic_search():
    """Test semantic search functionality"""
    
    print("=" * 70)
    print("🧪 TESTING SEMANTIC SEARCH & RAG SYSTEM")
    print("=" * 70)
    
    # Check vector store
    print("\n1️⃣ Checking Vector Store...")
    try:
        count = vector_store.get_collection_count()
        print(f"   ✅ Vector store connected")
        print(f"   📊 Documents indexed: {count}")
        
        if count == 0:
            print("\n   ⚠️  No documents indexed!")
            print("   Run: python index_placement_data.py")
            return
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return
    
    # Test queries
    test_queries = [
        "Which branch has the best placement percentage?",
        "What is the highest package offered?",
        "How many companies participated?",
        "What is the average salary for CSE?"
    ]
    
    print(f"\n2️⃣ Testing {len(test_queries)} Queries...")
    print("-" * 70)
    
    for i, query in enumerate(test_queries, 1):
        print(f"\n📝 Query {i}: {query}")
        try:
            result = rag_service.query(query, n_results=3)
            print(f"   ✅ Answer: {result['answer'][:150]}...")
            print(f"   📊 Confidence: {result['confidence']}")
            print(f"   📚 Sources used: {len(result['sources'])}")
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    print("\n" + "=" * 70)
    print("✅ TESTING COMPLETE!")
    print("=" * 70)
    print("\n💡 To use in your application:")
    print("   - Start server: python main.py")
    print("   - API endpoint: POST /api/semantic-search/query")
    print("   - Health check: GET /api/semantic-search/health")

if __name__ == "__main__":
    asyncio.run(test_semantic_search())
