"""
Store 2025 Batch Placement Data from Images
Extracted from: Unique Company List_18.07.2025.pdf
Date: 12-04-2025
"""

import asyncio
from datetime import datetime
from pymongo import MongoClient
import os
from dotenv import load_dotenv
import hashlib

# Load environment variables
load_dotenv()

# MongoDB connection
MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017/')
client = MongoClient(MONGODB_URI)
db = client['campusaura']

def calculate_content_hash(content: str) -> str:
    """Calculate MD5 hash of content for duplicate detection"""
    return hashlib.md5(content.encode('utf-8')).hexdigest()

# Comprehensive placement data structure
placement_data = {
    "filename": "Unique Company List_18.07.2025.pdf",
    "fileType": "placement_statistics",
    "category": "placements",
    "tags": ["2025 batch", "placement statistics", "salary data", "company list", "branch-wise placement"],
    "size": 0,  # Images, not actual file
    "uploadedAt": datetime.utcnow(),
    "uploadedBy": "admin",
    "dataSource": "Manual extraction from images",
    "extractionDate": "2025-04-12",
    
    "textContent": """
    2025 Batch Placement Highlights (as on 12-04-2025)
    
    Overall Statistics:
    - Total Students Enrolled: 1,027
    - Total Students Placed: 658
    - Overall Placement Percentage: 64.07%
    - Total Companies: 203
    - Total Job Offers: 901
    
    Salary Package Details:
    - Highest Salary: 46.4 LPA
    - Average Salary: 8.07-8.97 LPA
    - Median Salary: 6.0-6.20 LPA
    - Lowest Salary: 3.5 LPA
    
    Branch-wise placement statistics with detailed CTC information for all 11 branches.
    5-year placement trend showing growth from 2021 to 2024.
    Internship statistics for 2023 and 2024.
    """,
    
    "extractedData": {
        "overall_statistics": {
            "batch_year": "2025",
            "as_on_date": "2025-04-12",
            "total_students_enrolled": 1027,
            "total_students_placed": 658,
            "overall_placement_percentage": 64.07,
            "total_companies": 203,
            "total_job_offers": 901,
            "status": "In Progress"
        },
        
        "salary_packages": {
            "highest_salary_lpa": 46.4,
            "average_salary_lpa": 8.97,
            "average_salary_alternate_lpa": 8.07,
            "median_salary_lpa": 6.20,
            "median_salary_alternate_lpa": 6.0,
            "lowest_salary_lpa": 3.5
        },
        
        "branch_wise_statistics": [
            {
                "branch": "ISE",
                "students_registered": 208,
                "students_placed": 169,
                "placement_percentage": 81.25,
                "highest_ctc_lpa": 28.00,
                "lowest_ctc_lpa": 3.25,
                "average_ctc_lpa": 8.49
            },
            {
                "branch": "CIVIL",
                "students_registered": 31,
                "students_placed": 26,
                "placement_percentage": 83.87,
                "highest_ctc_lpa": 7.50,
                "lowest_ctc_lpa": 3.60,
                "average_ctc_lpa": 4.68
            },
            {
                "branch": "AI&ML",
                "students_registered": 58,
                "students_placed": 47,
                "placement_percentage": 81.03,
                "highest_ctc_lpa": 23.00,
                "lowest_ctc_lpa": 3.25,
                "average_ctc_lpa": 8.72
            },
            {
                "branch": "CSE",
                "students_registered": 203,
                "students_placed": 153,
                "placement_percentage": 75.37,
                "highest_ctc_lpa": 33.00,
                "lowest_ctc_lpa": 3.25,
                "average_ctc_lpa": 9.31
            },
            {
                "branch": "MECH",
                "students_registered": 34,
                "students_placed": 23,
                "placement_percentage": 67.65,
                "highest_ctc_lpa": 4.60,
                "lowest_ctc_lpa": 3.50,
                "average_ctc_lpa": 2.46
            },
            {
                "branch": "ECE",
                "students_registered": 142,
                "students_placed": 94,
                "placement_percentage": 66.20,
                "highest_ctc_lpa": 26.35,
                "lowest_ctc_lpa": 3.25,
                "average_ctc_lpa": 7.53
            },
            {
                "branch": "ETE",
                "students_registered": 47,
                "students_placed": 31,
                "placement_percentage": 65.96,
                "highest_ctc_lpa": 9.00,
                "lowest_ctc_lpa": 3.25,
                "average_ctc_lpa": 5.31
            },
            {
                "branch": "EEE",
                "students_registered": 55,
                "students_placed": 30,
                "placement_percentage": 54.55,
                "highest_ctc_lpa": 23.00,
                "lowest_ctc_lpa": 3.25,
                "average_ctc_lpa": 5.54
            },
            {
                "branch": "MTECH",
                "students_registered": 25,
                "students_placed": 11,
                "placement_percentage": 44.00,
                "highest_ctc_lpa": None,
                "lowest_ctc_lpa": None,
                "average_ctc_lpa": None
            },
            {
                "branch": "MBA",
                "students_registered": 114,
                "students_placed": 40,
                "placement_percentage": 35.09,
                "highest_ctc_lpa": None,
                "lowest_ctc_lpa": None,
                "average_ctc_lpa": None
            },
            {
                "branch": "MCA",
                "students_registered": 110,
                "students_placed": 34,
                "placement_percentage": 30.91,
                "highest_ctc_lpa": 12.00,
                "lowest_ctc_lpa": 4.00,
                "average_ctc_lpa": 5.98
            }
        ],
        
        "historical_trend": [
            {
                "year": 2021,
                "students_enrolled": 551,
                "students_placed": 458,
                "placement_percentage": 83.12
            },
            {
                "year": 2022,
                "students_enrolled": 789,
                "students_placed": 699,
                "placement_percentage": 88.59
            },
            {
                "year": 2023,
                "students_enrolled": 843,
                "students_placed": 786,
                "placement_percentage": 93.24
            },
            {
                "year": 2024,
                "students_enrolled": 819,
                "students_placed": 798,
                "placement_percentage": 97.44
            },
            {
                "year": 2025,
                "students_enrolled": 1002,
                "students_placed": 658,
                "placement_percentage": 65.67,
                "status": "In Progress"
            }
        ],
        
        "internship_statistics": {
            "2024": {
                "as_on_date": "2024-04-12",
                "total_internships": 1303,
                "paid_internships": 601,
                "minimum_stipend_per_month": 10000,
                "highest_stipend_per_month": 50000
            },
            "2023": {
                "total_internships": 1246,
                "paid_internships": 663,
                "minimum_stipend_per_month": 12000,
                "highest_stipend_per_month": 80000
            }
        },
        
        "key_insights": {
            "best_performing_branches": [
                {"branch": "CIVIL", "placement_percentage": 83.87},
                {"branch": "AI&ML", "placement_percentage": 81.03},
                {"branch": "ISE", "placement_percentage": 81.25}
            ],
            "highest_average_packages": [
                {"branch": "CSE", "average_ctc_lpa": 9.31},
                {"branch": "AI&ML", "average_ctc_lpa": 8.72},
                {"branch": "ISE", "average_ctc_lpa": 8.49}
            ],
            "top_salary_offer": {
                "branch": "CSE",
                "package_lpa": 33.00
            },
            "companies_participated": 203,
            "placement_status": "In Progress",
            "expected_improvement": "Significant - based on historical trend"
        }
    },
    
    "metadata": {
        "document_type": "Placement Statistics Report",
        "academic_year": "2024-2025",
        "batch": "2025",
        "report_date": "2025-04-12",
        "report_title": "2025 Batch Highlights",
        "data_completeness": "Comprehensive",
        "includes": [
            "Overall statistics",
            "Salary packages",
            "Branch-wise placement data",
            "5-year historical trend",
            "Internship statistics",
            "Key insights"
        ]
    }
}

# Calculate content hash
content_str = str(placement_data["extractedData"])
placement_data["contentHash"] = calculate_content_hash(content_str)

async def store_data():
    """Store placement data in database"""
    
    print("🔍 Checking for duplicates...")
    
    # Check if this data already exists
    existing = db.placements.find_one({
        'contentHash': placement_data['contentHash']
    })
    
    if existing:
        print(f"⚠️  Duplicate found! File already exists with ID: {existing['_id']}")
        print(f"   Uploaded at: {existing['uploadedAt']}")
        
        # Update instead of duplicate
        update_choice = input("\n📝 Do you want to update the existing record? (y/n): ")
        if update_choice.lower() == 'y':
            result = db.placements.update_one(
                {'_id': existing['_id']},
                {'$set': placement_data}
            )
            print(f"✅ Updated existing record successfully!")
            print(f"   Document ID: {existing['_id']}")
        else:
            print("❌ Skipped storage - duplicate prevented")
        return
    
    print("💾 Storing new placement data...")
    
    # Insert into placements collection
    result = db.placements.insert_one(placement_data)
    
    print(f"\n✅ PLACEMENT DATA STORED SUCCESSFULLY!")
    print(f"   Collection: placements")
    print(f"   Document ID: {result.inserted_id}")
    print(f"   Content Hash: {placement_data['contentHash'][:16]}...")
    
    print(f"\n📊 Data Summary:")
    print(f"   • Batch: 2025")
    print(f"   • Students Enrolled: 1,027")
    print(f"   • Students Placed: 658 (64.07%)")
    print(f"   • Companies: 203")
    print(f"   • Job Offers: 901")
    print(f"   • Highest Package: 46.4 LPA")
    print(f"   • Average Package: 8.97 LPA")
    print(f"   • Branches Covered: 11")
    print(f"   • Historical Data: 2021-2025")
    print(f"   • Internship Stats: 2023-2024")
    
    print(f"\n🎯 Data Structure:")
    print(f"   ✓ Overall statistics")
    print(f"   ✓ Salary packages (highest, average, median, lowest)")
    print(f"   ✓ Branch-wise statistics (11 branches)")
    print(f"   ✓ 5-year historical trend")
    print(f"   ✓ Internship statistics")
    print(f"   ✓ Key insights & analytics")
    
    print(f"\n🔍 Query Examples:")
    print(f"   db.placements.find({{'category': 'placements'}})")
    print(f"   db.placements.find({{'extractedData.overall_statistics.batch_year': '2025'}})")
    print(f"   db.placements.find({{'tags': '2025 batch'}})")

if __name__ == "__main__":
    print("=" * 80)
    print("📁 2025 BATCH PLACEMENT DATA STORAGE")
    print("=" * 80)
    print(f"\nSource: Unique Company List_18.07.2025.pdf (Image Analysis)")
    print(f"Date: April 12, 2025")
    print(f"Target Collection: placements")
    print("\n" + "=" * 80 + "\n")
    
    asyncio.run(store_data())
    
    print("\n" + "=" * 80)
    print("🎉 PROCESS COMPLETED!")
    print("=" * 80)
