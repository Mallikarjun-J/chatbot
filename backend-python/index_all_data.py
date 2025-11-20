"""
Universal Indexing Script - Index ALL data into vector store
Indexes: placements, announcements, documents, timetables, knowledge_base, etc.
"""

from pymongo import MongoClient
from app.services.vectorStore import vector_store
import os
from dotenv import load_dotenv
import json
from datetime import datetime

load_dotenv()

# Connect to MongoDB
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
client = MongoClient(MONGODB_URI)
db = client['campusaura']

def index_placements():
    """Index placement documents"""
    placements = list(db.placements.find({}))
    if not placements:
        return []
    
    documents = []
    for placement in placements:
        doc_id = f"placement_{placement['_id']}"
        text_parts = []
        
        # Basic info
        text_parts.append(f"Document Type: Placement Statistics")
        text_parts.append(f"Batch Year: {placement.get('extractedData', {}).get('overall_statistics', {}).get('batch_year', 'N/A')}")
        
        # Overall statistics
        overall = placement.get('extractedData', {}).get('overall_statistics', {})
        text_parts.append(f"""
Overall Placement Statistics:
- Total Students: {overall.get('total_students_enrolled', 'N/A')}
- Students Placed: {overall.get('total_students_placed', 'N/A')}
- Placement Percentage: {overall.get('overall_placement_percentage', 'N/A')}%
- Total Companies: {overall.get('total_companies', 'N/A')}
- Total Offers: {overall.get('total_job_offers', 'N/A')}
        """)
        
        # Salary info
        salaries = placement.get('extractedData', {}).get('salary_packages', {})
        text_parts.append(f"""
Salary Packages:
- Highest: {salaries.get('highest_salary_lpa', 'N/A')} LPA
- Average: {salaries.get('average_salary_lpa', 'N/A')} LPA
- Median: {salaries.get('median_salary_lpa', 'N/A')} LPA
        """)
        
        # Branch-wise data
        branches = placement.get('extractedData', {}).get('branch_wise_statistics', [])
        if branches:
            text_parts.append("\nBranch-wise Placement Data:")
            for branch in branches:
                text_parts.append(f"{branch.get('branch')}: {branch.get('placement_percentage')}% placed, Avg CTC: {branch.get('average_ctc_lpa')} LPA")
        
        documents.append({
            'id': doc_id,
            'text': "\n".join(text_parts),
            'metadata': {
                'type': 'placement',
                'batch_year': placement.get('extractedData', {}).get('overall_statistics', {}).get('batch_year', ''),
                'category': 'placements'
            }
        })
    
    return documents

def index_announcements():
    """Index announcements"""
    announcements = list(db.announcements.find({}))
    if not announcements:
        return []
    
    documents = []
    for announcement in announcements:
        doc_id = f"announcement_{announcement['_id']}"
        text_parts = []
        
        text_parts.append(f"Document Type: Announcement")
        text_parts.append(f"Title: {announcement.get('title', 'N/A')}")
        text_parts.append(f"Content: {announcement.get('content', 'N/A')}")
        text_parts.append(f"Category: {announcement.get('category', 'N/A')}")
        text_parts.append(f"Priority: {announcement.get('priority', 'N/A')}")
        
        if announcement.get('targetAudience'):
            text_parts.append(f"Target Audience: {', '.join(announcement.get('targetAudience', []))}")
        
        if announcement.get('date'):
            text_parts.append(f"Date: {announcement.get('date')}")
        
        documents.append({
            'id': doc_id,
            'text': "\n".join(text_parts),
            'metadata': {
                'type': 'announcement',
                'category': announcement.get('category', ''),
                'priority': announcement.get('priority', '')
            }
        })
    
    return documents

def index_documents():
    """Index uploaded documents"""
    docs = list(db.documents.find({}))
    if not docs:
        return []
    
    documents = []
    for doc in docs:
        doc_id = f"document_{doc['_id']}"
        text_parts = []
        
        text_parts.append(f"Document Type: Uploaded Document")
        text_parts.append(f"Filename: {doc.get('filename', 'N/A')}")
        text_parts.append(f"Title: {doc.get('title', 'N/A')}")
        text_parts.append(f"Description: {doc.get('description', 'N/A')}")
        text_parts.append(f"Category: {doc.get('category', 'N/A')}")
        
        if doc.get('tags'):
            text_parts.append(f"Tags: {', '.join(doc.get('tags', []))}")
        
        # Extract text content if available
        if doc.get('extractedText'):
            text_parts.append(f"\nContent:\n{doc.get('extractedText', '')[:1000]}")
        
        documents.append({
            'id': doc_id,
            'text': "\n".join(text_parts),
            'metadata': {
                'type': 'document',
                'category': doc.get('category', ''),
                'filename': doc.get('filename', '')
            }
        })
    
    return documents

def index_knowledge_base():
    """Index knowledge base (scraped website content)"""
    kb_items = list(db.knowledge_base.find({}))
    if not kb_items:
        return []
    
    documents = []
    for item in kb_items:
        doc_id = f"kb_{item['_id']}"
        text_parts = []
        
        text_parts.append(f"Document Type: Web Content")
        text_parts.append(f"Title: {item.get('title', 'N/A')}")
        text_parts.append(f"URL: {item.get('url', 'N/A')}")
        
        if item.get('content'):
            # Limit content to avoid token overflow
            content = item.get('content', '')[:2000]
            text_parts.append(f"\nContent:\n{content}")
        
        if item.get('category'):
            text_parts.append(f"Category: {item.get('category')}")
        
        documents.append({
            'id': doc_id,
            'text': "\n".join(text_parts),
            'metadata': {
                'type': 'knowledge_base',
                'url': item.get('url', ''),
                'category': item.get('category', '')
            }
        })
    
    return documents

def index_timetables():
    """Index timetables"""
    timetables = list(db.timetables.find({}))
    if not timetables:
        return []
    
    documents = []
    for timetable in timetables:
        doc_id = f"timetable_{timetable['_id']}"
        text_parts = []
        
        text_parts.append(f"Document Type: Timetable")
        text_parts.append(f"Branch: {timetable.get('branch', 'N/A')}")
        text_parts.append(f"Section: {timetable.get('section', 'N/A')}")
        text_parts.append(f"Semester: {timetable.get('semester', 'N/A')}")
        
        # Include schedule if available
        if timetable.get('schedule'):
            text_parts.append("\nSchedule:")
            for day, classes in timetable.get('schedule', {}).items():
                text_parts.append(f"{day}: {', '.join([c.get('subject', '') for c in classes])}")
        
        documents.append({
            'id': doc_id,
            'text': "\n".join(text_parts),
            'metadata': {
                'type': 'timetable',
                'branch': timetable.get('branch', ''),
                'section': timetable.get('section', '')
            }
        })
    
    return documents

def index_all_data():
    """Index all data from all collections"""
    
    print("=" * 80)
    print("🌍 UNIVERSAL DATA INDEXING - ALL COLLECTIONS")
    print("=" * 80)
    print(f"\nDatabase: campusaura")
    print(f"Target: Vector Store (ChromaDB)")
    print("\n" + "=" * 80 + "\n")
    
    all_documents = []
    
    # Index each collection
    print("📊 Indexing Placements...")
    placement_docs = index_placements()
    all_documents.extend(placement_docs)
    print(f"   ✓ {len(placement_docs)} placement documents prepared")
    
    print("\n📢 Indexing Announcements...")
    announcement_docs = index_announcements()
    all_documents.extend(announcement_docs)
    print(f"   ✓ {len(announcement_docs)} announcement documents prepared")
    
    print("\n📄 Indexing Documents...")
    document_docs = index_documents()
    all_documents.extend(document_docs)
    print(f"   ✓ {len(document_docs)} uploaded documents prepared")
    
    print("\n🌐 Indexing Knowledge Base (Web Content)...")
    kb_docs = index_knowledge_base()
    all_documents.extend(kb_docs)
    print(f"   ✓ {len(kb_docs)} knowledge base items prepared")
    
    print("\n📅 Indexing Timetables...")
    timetable_docs = index_timetables()
    all_documents.extend(timetable_docs)
    print(f"   ✓ {len(timetable_docs)} timetable documents prepared")
    
    # Index all documents
    if not all_documents:
        print("\n❌ No documents found to index!")
        return
    
    print(f"\n" + "=" * 80)
    print(f"📥 Indexing {len(all_documents)} total documents into vector store...")
    print("=" * 80)
    
    vector_store.add_documents_batch(all_documents)
    
    print(f"\n✅ Successfully indexed {len(all_documents)} documents!")
    print(f"📊 Vector store now contains {vector_store.get_collection_count()} documents total")
    
    # Show breakdown
    print(f"\n📈 Breakdown by Type:")
    print(f"   • Placements: {len(placement_docs)}")
    print(f"   • Announcements: {len(announcement_docs)}")
    print(f"   • Documents: {len(document_docs)}")
    print(f"   • Knowledge Base: {len(kb_docs)}")
    print(f"   • Timetables: {len(timetable_docs)}")
    
    print("\n" + "=" * 80)
    print("🔍 Example Queries You Can Try:")
    print("=" * 80)
    print("  📊 Placements:")
    print("     • Which branch has the best placement percentage?")
    print("     • What is the highest package offered?")
    print("     • How many companies participated?")
    print("\n  📢 Announcements:")
    print("     • What are the latest announcements?")
    print("     • Any important notices for students?")
    print("     • Show me exam-related announcements")
    print("\n  📄 Documents:")
    print("     • Find documents about admissions")
    print("     • Show me syllabus documents")
    print("     • What documents are available?")
    print("\n  🌐 General:")
    print("     • Tell me about the college")
    print("     • What facilities are available?")
    print("     • How do I apply for admission?")
    print("\n  📅 Timetables:")
    print("     • What's the timetable for CSE section A?")
    print("     • Show me class schedule")
    print("=" * 80)

if __name__ == "__main__":
    index_all_data()
