from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

async def check():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['campusaura']
    
    print('\n=== STUDENTS IN DATABASE ===')
    students = await db.users.find({"role": "Student"}).to_list(length=100)
    print(f"Total students: {len(students)}\n")
    for s in students[:5]:  # Show first 5
        print(f"Name: {s.get('name')}")
        print(f"Email: {s.get('email')}")
        print(f"Role: {s.get('role')}")
        print(f"Semester: {s.get('semester')}")
        print(f"Branch: {s.get('branch')}")
        print('---\n')
    
    print('\n=== TEACHERS IN DATABASE ===')
    teachers = await db.users.find({"role": "Teacher"}).to_list(length=100)
    print(f"Total teachers: {len(teachers)}\n")
    for t in teachers:
        print(f"Name: {t.get('name')}")
        print(f"Email: {t.get('email')}")
        print(f"Role: {t.get('role')}")
        print(f"Branch/Department: {t.get('branch')}")
        print('---\n')
    
    if len(teachers) == 0:
        print("⚠️  NO TEACHERS FOUND IN DATABASE!")
        print("This is why emails are not being sent to teachers.")
    
    client.close()

asyncio.run(check())
