import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_timetables():
    # Connect to MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["campusaura"]
    
    print("\n=== Checking teachers_timetable collection ===")
    
    # Get all teacher timetables
    timetables = await db.teachers_timetable.find({}).to_list(length=100)
    
    print(f"\nFound {len(timetables)} teacher timetables:\n")
    
    for tt in timetables:
        print(f"ID: {tt.get('_id')}")
        print(f"Teacher Name: {tt.get('teacherName')}")
        print(f"Teacher Email: {tt.get('teacherEmail')}")
        print(f"Branch: {tt.get('branch')}")
        print(f"Days: {list(tt.get('days', {}).keys())}")
        print(f"Created At: {tt.get('createdAt')}")
        print("-" * 50)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_timetables())
