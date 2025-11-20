"""
Index existing placement data into vector store
Run this once to populate the vector database
"""

from pymongo import MongoClient
from app.services.vectorStore import vector_store
import os
from dotenv import load_dotenv
import json

load_dotenv()

# Connect to MongoDB
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
client = MongoClient(MONGODB_URI)
db = client['campusaura']

def index_placements():
    """Index all placement documents"""
    
    print("📊 Indexing Placement Data into Vector Store\n")
    print("=" * 60)
    
    placements = list(db.placements.find({}))
    
    if not placements:
        print("❌ No placement data found!")
        return
    
    print(f"Found {len(placements)} placement documents\n")
    
    documents_to_index = []
    
    for placement in placements:
        doc_id = str(placement['_id'])
        
        # Build searchable text content
        text_parts = []
        
        # Add basic info
        text_parts.append(f"Batch Year: {placement.get('extractedData', {}).get('overall_statistics', {}).get('batch_year', 'N/A')}")
        
        # Add overall statistics
        overall = placement.get('extractedData', {}).get('overall_statistics', {})
        text_parts.append(f"""
Overall Placement Statistics:
- Total Students: {overall.get('total_students_enrolled', 'N/A')}
- Students Placed: {overall.get('total_students_placed', 'N/A')}
- Placement Percentage: {overall.get('overall_placement_percentage', 'N/A')}%
- Total Companies: {overall.get('total_companies', 'N/A')}
- Total Offers: {overall.get('total_job_offers', 'N/A')}
        """)
        
        # Add salary info
        salaries = placement.get('extractedData', {}).get('salary_packages', {})
        text_parts.append(f"""
Salary Packages:
- Highest: {salaries.get('highest_salary_lpa', 'N/A')} LPA
- Average: {salaries.get('average_salary_lpa', 'N/A')} LPA
- Median: {salaries.get('median_salary_lpa', 'N/A')} LPA
- Lowest: {salaries.get('lowest_salary_lpa', 'N/A')} LPA
        """)
        
        # Add branch-wise data
        branches = placement.get('extractedData', {}).get('branch_wise_statistics', [])
        if branches:
            text_parts.append("\nBranch-wise Placement Data:")
            for branch in branches:
                text_parts.append(f"""
{branch.get('branch', 'N/A')}:
- Students Registered: {branch.get('students_registered', 'N/A')}
- Students Placed: {branch.get('students_placed', 'N/A')}
- Placement Percentage: {branch.get('placement_percentage', 'N/A')}%
- Highest CTC: {branch.get('highest_ctc_lpa', 'N/A')} LPA
- Average CTC: {branch.get('average_ctc_lpa', 'N/A')} LPA
                """)
        
        # Add historical trend
        trends = placement.get('extractedData', {}).get('historical_trend', [])
        if trends:
            text_parts.append("\nHistorical Placement Trends:")
            for trend in trends:
                text_parts.append(f"Year {trend.get('year')}: {trend.get('students_placed')} placed out of {trend.get('students_enrolled')} ({trend.get('placement_percentage')}%)")
        
        # Add internship info
        internships = placement.get('extractedData', {}).get('internship_statistics', {})
        if internships:
            text_parts.append("\nInternship Information:")
            for year, data in internships.items():
                text_parts.append(f"Year {year}: {data.get('total_internships')} internships, {data.get('paid_internships')} paid")
        
        # Add key insights
        insights = placement.get('extractedData', {}).get('key_insights', {})
        if insights:
            text_parts.append("\nKey Insights:")
            
            best_branches = insights.get('best_performing_branches', [])
            if best_branches:
                text_parts.append("Best Performing Branches:")
                for b in best_branches:
                    text_parts.append(f"  - {b.get('branch')}: {b.get('placement_percentage')}%")
            
            highest_packages = insights.get('highest_average_packages', [])
            if highest_packages:
                text_parts.append("Highest Average Packages:")
                for p in highest_packages:
                    text_parts.append(f"  - {p.get('branch')}: {p.get('average_ctc_lpa')} LPA")
            
            top_offer = insights.get('top_salary_offer', {})
            if top_offer:
                text_parts.append(f"Top Salary Offer: {top_offer.get('branch')} branch - {top_offer.get('package_lpa')} LPA")
        
        full_text = "\n".join(text_parts)
        
        documents_to_index.append({
            'id': doc_id,
            'text': full_text,
            'metadata': {
                'batch_year': placement.get('extractedData', {}).get('overall_statistics', {}).get('batch_year', ''),
                'document_type': placement.get('fileType', ''),
                'category': placement.get('category', ''),
                'filename': placement.get('filename', '')
            }
        })
        
        print(f"✓ Prepared: {placement.get('filename', 'Unknown')} ({len(full_text)} chars)")
    
    # Index all documents
    print(f"\n📥 Indexing {len(documents_to_index)} documents...")
    vector_store.add_documents_batch(documents_to_index)
    
    print(f"\n✅ Successfully indexed {len(documents_to_index)} placement documents!")
    print(f"📊 Vector store now contains {vector_store.get_collection_count()} documents")
    
    print("\n" + "=" * 60)
    print("🔍 Example Queries You Can Try:")
    print("=" * 60)
    print("  • Which branch has the best placement percentage?")
    print("  • What is the highest package offered?")
    print("  • How many companies participated in 2025?")
    print("  • What is the average salary for CSE branch?")
    print("  • Show me the 5-year placement trend")
    print("  • Which branch has the lowest placement percentage?")
    print("  • What are the internship statistics?")
    print("  • Compare CSE and ISE placement statistics")
    print("=" * 60)

if __name__ == "__main__":
    index_placements()
