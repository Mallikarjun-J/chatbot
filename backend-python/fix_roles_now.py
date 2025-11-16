import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix_roles():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client.campus
    
    # Update all users to have capitalized roles
    await db.users.update_one(
        {"email": "headcampusaura@gmail.com"},
        {"$set": {"role": "Admin"}}
    )
    await db.users.update_one(
        {"email": "teacher@campusaura.com"},
        {"$set": {"role": "Teacher"}}
    )
    await db.users.update_one(
        {"email": "student@campusaura.com"},
        {"$set": {"role": "Student"}}
    )
    
    print("✅ Updated all roles to capitalized format")
    
    # Verify
    users = await db.users.find({}, {"name": 1, "email": 1, "role": 1, "_id": 0}).to_list(length=10)
    print("\n--- Updated Users ---")
    for user in users:
        print(f"{user['name']}: role='{user['role']}'")
    
    client.close()

asyncio.run(fix_roles())
