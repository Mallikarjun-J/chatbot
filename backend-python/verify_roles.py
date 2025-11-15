import asyncio
import json
from motor.motor_asyncio import AsyncIOMotorClient

async def check_roles():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    users = await client.campus.users.find({}, {"name": 1, "email": 1, "role": 1, "_id": 0}).to_list(length=10)
    
    print("\n" + "="*60)
    print("DATABASE USERS AND THEIR ROLES")
    print("="*60)
    
    for user in users:
        print(f"\nName: {user['name']}")
        print(f"Email: {user['email']}")
        print(f"Role: '{user['role']}'")
        
        # Check capitalization
        expected_roles = ["Admin", "Teacher", "Student"]
        if user['role'] in expected_roles:
            print(f"✅ CORRECT - Role is capitalized")
        else:
            print(f"❌ WRONG - Role should be capitalized (expected one of: {expected_roles})")
    
    print("\n" + "="*60)
    client.close()

asyncio.run(check_roles())
