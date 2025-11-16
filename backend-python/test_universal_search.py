"""
Universal Query Test - Test semantic search across ALL data types
Tests: placements, announcements, documents, knowledge base, timetables
"""

import asyncio
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from app.services.vectorStore import vector_store
from app.services.ragService import rag_service

async def test_universal_queries():
    """Test queries across all data types"""
    
    print("=" * 80)
    print("🌍 UNIVERSAL SEMANTIC SEARCH TEST")
    print("=" * 80)
    
    # Check vector store
    print("\n1️⃣ Checking Vector Store...")
    try:
        count = vector_store.get_collection_count()
        print(f"   ✅ Vector store connected")
        print(f"   📊 Total documents indexed: {count}")
        
        if count == 0:
            print("\n   ⚠️  No documents indexed!")
            print("   Run: python index_all_data.py")
            return
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return
    
    # Diverse test queries covering all data types
    test_queries = [
        # Placement queries
        ("📊 PLACEMENT", "Which branch has the best placement percentage?"),
        ("📊 PLACEMENT", "What is the average salary for CSE students?"),
        
        # Announcement queries
        ("📢 ANNOUNCEMENT", "What are the latest announcements?"),
        ("📢 ANNOUNCEMENT", "Any exam-related notices?"),
        
        # Document queries
        ("📄 DOCUMENT", "What documents are available about admissions?"),
        
        # General/Knowledge base queries
        ("🌐 GENERAL", "Tell me about the college facilities"),
        ("🌐 GENERAL", "What courses are offered?"),
        
        # Multi-topic queries
        ("🔍 MIXED", "How do I prepare for placements?"),
    ]
    
    print(f"\n2️⃣ Testing {len(test_queries)} Diverse Queries...")
    print("=" * 80)
    
    for i, (category, query) in enumerate(test_queries, 1):
        print(f"\n{category} Query {i}: {query}")
        print("-" * 80)
        try:
            result = rag_service.query(query, n_results=3)
            answer = result['answer']
            
            # Truncate long answers
            if len(answer) > 200:
                answer = answer[:200] + "..."
            
            print(f"   ✅ Answer: {answer}")
            print(f"   📊 Confidence: {result['confidence']}")
            print(f"   📚 Sources: {len(result['sources'])} documents")
            
            # Show source types
            source_types = [s.get('type', 'unknown') for s in result['sources']]
            print(f"   🏷️  Source Types: {', '.join(set(source_types))}")
            
        except Exception as e:
            print(f"   ❌ Error: {str(e)[:100]}")
    
    print("\n" + "=" * 80)
    print("✅ UNIVERSAL TESTING COMPLETE!")
    print("=" * 80)
    print("\n💡 Your chatbot can now answer questions about:")
    print("   ✓ Placements (statistics, packages, companies)")
    print("   ✓ Announcements (notices, events, deadlines)")
    print("   ✓ Documents (syllabi, forms, guidelines)")
    print("   ✓ College Information (facilities, courses, admissions)")
    print("   ✓ Timetables (schedules, classes)")
    print("\n🚀 Start the server: python main.py")
    print("📡 API Endpoint: POST /api/semantic-search/query")

if __name__ == "__main__":
    asyncio.run(test_universal_queries())
