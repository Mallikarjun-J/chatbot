"""
Script to clear the knowledge_base collection
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

async def clear_knowledge_base():
    """Delete all documents from knowledge_base collection"""
    try:
        # Get MongoDB connection details
        mongodb_url = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
        db_name = os.getenv("DB_NAME", "campusaura")
        
        # Connect to MongoDB
        client = AsyncIOMotorClient(mongodb_url)
        db = client[db_name]
        
        print(f"\n🔗 Connected to database: {db_name}")
        print(f"📦 Targeting collection: knowledge_base")
        
        # Count documents before deletion
        count_before = await db.knowledge_base.count_documents({})
        print(f"📊 Documents found: {count_before}")
        
        if count_before == 0:
            print(f"✓ Collection is already empty!\n")
            client.close()
            return 0
        
        # Delete all documents
        result = await db.knowledge_base.delete_many({})
        
        print(f"\n✅ Successfully deleted {result.deleted_count} documents from knowledge_base collection")
        print(f"✓ Collection is now empty and ready for fresh scraping!\n")
        
        # Close connection
        client.close()
        
        return result.deleted_count
        
    except Exception as e:
        print(f"\n❌ Error clearing collection: {e}\n")
        return 0

if __name__ == "__main__":
    asyncio.run(clear_knowledge_base())
