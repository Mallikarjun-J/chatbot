import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_users():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    users = await client.campus.users.find().to_list(length=10)
    
    print(f"Total users: {len(users)}\n")
    for user in users:
        print(f"Email: {user.get('email')}")
        print(f"Role: '{user.get('role')}'")
        print(f"Role type: {type(user.get('role'))}")
        print("---")
    
    client.close()

asyncio.run(check_users())
