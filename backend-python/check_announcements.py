from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import json

async def check():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['campusaura']
    announcements = await db.announcements.find().to_list(length=100)
    
    print('\n=== ANNOUNCEMENTS IN DATABASE ===')
    print(f"Total announcements: {len(announcements)}\n")
    
    for i, a in enumerate(announcements, 1):
        print(f"{i}. Title: {a.get('title')}")
        print(f"   TargetRole: {a.get('targetRole', '❌ NOT SET')}")
        print(f"   Branch: {a.get('branch', 'None')}")
        print(f"   Semester: {a.get('semester', 'None')}")
        print(f"   All fields: {list(a.keys())}")
        print()
    
    # Update old announcements to have targetRole
    print("\n=== UPDATING OLD ANNOUNCEMENTS ===")
    result = await db.announcements.update_many(
        {"targetRole": {"$exists": False}},
        {"$set": {"targetRole": "Students"}}
    )
    print(f"Updated {result.modified_count} announcements to have targetRole='Students'\n")
    
    client.close()

asyncio.run(check())
