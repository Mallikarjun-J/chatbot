#!/usr/bin/env python3
"""
Test 2025 Placements Query
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

print("🔍 Testing 2025 Placements Query")
print("=" * 80)

# Import services
from app.services.ragService import rag_service

# Test query
query = "tell me about 2025 placements"
print(f"\n📝 Query: {query}")
print("-" * 80)

try:
    result = rag_service.query(query, n_results=3)
    
    print(f"\n✅ Answer:")
    print(result['answer'])
    print(f"\n📊 Confidence: {result.get('confidence', 'unknown')}")
    print(f"📚 Sources: {len(result.get('sources', []))} documents")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    import traceback
    traceback.print_exc()
