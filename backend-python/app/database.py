"""
Database connection and operations using Motor (async MongoDB driver)
Provides connection management, CRUD operations, and utility functions.
"""

import os
import warnings
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import bcrypt
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)

# Suppress bcrypt warnings
warnings.filterwarnings("ignore", category=UserWarning)

# Global database instance
client: Optional[AsyncIOMotorClient] = None
db: Optional[AsyncIOMotorDatabase] = None


class Database:
    """Database connection manager with collection references"""
    
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.db: Optional[AsyncIOMotorDatabase] = None
        
        # Collection references (initialized after connection)
        self.users = None
        self.announcements = None
        self.placements = None
        self.events = None
        self.examinations = None
        self.holidays = None
        self.documents = None
        self.student_timetables = None
        self.teachers_timetable = None
        self.knowledge_base = None
        self.ml_training_data = None
        self.scrape_config = None
    
    async def connect(self, uri: str, db_name: str):
        """Connect to MongoDB and initialize collections"""
        try:
            self.client = AsyncIOMotorClient(uri)
            self.db = self.client[db_name]
            
            # Test connection
            await self.client.admin.command('ping')
            logger.info(f"✅ Connected to MongoDB: {db_name}")
            
            # Initialize collection references
            self.users = self.db.users
            self.announcements = self.db.announcements
            self.placements = self.db.placements
            self.events = self.db.events
            self.examinations = self.db.examinations
            self.holidays = self.db.holidays
            self.documents = self.db.documents
            self.student_timetables = self.db.studentTimetables
            self.teachers_timetable = self.db.teachers_timetable
            self.knowledge_base = self.db.knowledge_base
            self.ml_training_data = self.db.mlTrainingData
            self.scrape_config = self.db.scrapeConfig
            
            return True
        except Exception as e:
            logger.error(f"❌ MongoDB connection failed: {str(e)}")
            raise
    
    async def close(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            logger.info("🔌 MongoDB connection closed")


# Global database instance
database = Database()


async def connect_db():
    """Connect to MongoDB database"""
    global client, db
    
    mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db_name = os.getenv("DB_NAME", "campusaura")
    
    try:
        await database.connect(mongodb_uri, db_name)
        client = database.client
        db = database.db
        
        # Create indexes for performance
        await create_indexes()
        
        # Seed default data if needed
        await seed_database()
        
        logger.info("✅ Database initialized successfully")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {str(e)}")
        raise


async def close_db():
    """Close database connection"""
    await database.close()


def get_database() -> AsyncIOMotorDatabase:
    """Get the current database instance"""
    if db is None:
        raise RuntimeError("Database not connected. Call connect_db() first.")
    return db


async def create_indexes():
    """Create database indexes for performance optimization"""
    try:
        # Users collection
        await db.users.create_index("email", unique=True)
        await db.users.create_index("role")
        
        # Announcements collection
        await db.announcements.create_index([("createdAt", -1)])
        await db.announcements.create_index("category")
        await db.announcements.create_index("priority")
        
        # Placements collection
        await db.placements.create_index([("date", -1)])
        await db.placements.create_index("company")
        
        # Events collection
        await db.events.create_index([("date", -1)])
        await db.events.create_index("category")
        
        # Examinations collection
        await db.examinations.create_index([("date", -1)])
        
        # Holidays collection
        await db.holidays.create_index([("date", -1)])
        
        # Documents collection
        await db.documents.create_index("category")
        await db.documents.create_index([("uploadDate", -1)])
        
        # Class timetables
        await db.classTimetables.create_index("className")
        await db.classTimetables.create_index("semester")
        
        # Teacher timetables
        await db.teachers_timetable.create_index("teacherId")
        await db.teachers_timetable.create_index("teacherName")
        
        # Knowledge base with text search
        await db.knowledge_base.create_index([("title", "text"), ("content", "text")])
        await db.knowledge_base.create_index("category")
        await db.knowledge_base.create_index([("createdAt", -1)])
        
        # ML training data
        await db.mlTrainingData.create_index("category")
        await db.mlTrainingData.create_index([("createdAt", -1)])
        
        logger.info("✅ Database indexes created")
    except Exception as e:
        logger.warning(f"⚠️ Index creation warning: {str(e)}")


async def seed_database():
    """Seed database with default data if empty"""
    try:
        # Check if users exist
        user_count = await db.users.count_documents({})
        
        if user_count == 0:
            # Create default users with capitalized roles to match frontend enum
            default_users = [
                {
                    "name": "Admin User",
                    "email": "headcampusaura@gmail.com",
                    "password": hash_password("admin123"),
                    "role": "Admin",
                    "department": "Administration",
                    "createdAt": datetime.utcnow()
                },
                {
                    "name": "Teacher Demo",
                    "email": "teacher@campusaura.com",
                    "password": hash_password("teacher123"),
                    "role": "Teacher",
                    "department": "Computer Science",
                    "createdAt": datetime.utcnow()
                },
                {
                    "name": "Student Demo",
                    "email": "student@campusaura.com",
                    "password": hash_password("student123"),
                    "role": "Student",
                    "department": "Computer Science",
                    "year": "3rd Year",
                    "createdAt": datetime.utcnow()
                }
            ]
            
            await db.users.insert_many(default_users)
            logger.info("✅ Default users created (admin/teacher/student)")
            logger.info("   📧 headcampusaura@gmail.com / admin123")
            logger.info("   📧 teacher@campusaura.com / teacher123")
            logger.info("   📧 student@campusaura.com / student123")
    except Exception as e:
        logger.error(f"❌ Seeding error: {str(e)}")


# ===== Password Utilities =====

def hash_password(password: str) -> str:
    """Hash a password using bcrypt (max 72 bytes)"""
    # Bcrypt has a 72 byte limit - encode to bytes and truncate
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt(rounds=10)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash (truncate to 72 bytes like hashing does)"""
    try:
        # Ensure same truncation as during hashing
        password_bytes = plain_password.encode('utf-8')[:72]
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False


# ===== Document Mapping Utilities =====

def map_document(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Convert MongoDB _id to id for single document"""
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc


def map_documents(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Convert MongoDB _id to id for multiple documents"""
    return [map_document(doc) for doc in docs]


# ===== ObjectId Validation =====

def is_valid_objectid(id_string: str) -> bool:
    """Check if a string is a valid MongoDB ObjectId"""
    try:
        ObjectId(id_string)
        return True
    except:
        return False


def to_objectid(id_string: str) -> Optional[ObjectId]:
    """Convert string to ObjectId, return None if invalid"""
    try:
        return ObjectId(id_string)
    except:
        return None


# ===== Common Database Operations =====

async def get_by_id(collection_name: str, doc_id: str) -> Optional[Dict[str, Any]]:
    """Get a document by ID from any collection"""
    if not is_valid_objectid(doc_id):
        return None
    
    collection = db[collection_name]
    doc = await collection.find_one({"_id": ObjectId(doc_id)})
    return map_document(doc) if doc else None


async def get_all(
    collection_name: str,
    filter_dict: Optional[Dict[str, Any]] = None,
    sort_by: Optional[str] = None,
    limit: Optional[int] = None,
    skip: Optional[int] = None
) -> List[Dict[str, Any]]:
    """Get multiple documents from any collection with filtering and pagination"""
    collection = db[collection_name]
    query = filter_dict or {}
    
    cursor = collection.find(query)
    
    if sort_by:
        # Default to descending order
        cursor = cursor.sort(sort_by, -1)
    
    if skip:
        cursor = cursor.skip(skip)
    
    if limit:
        cursor = cursor.limit(limit)
    
    docs = await cursor.to_list(length=None)
    return map_documents(docs)


async def create_document(collection_name: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new document in any collection"""
    collection = db[collection_name]
    
    # Add timestamp if not present
    if "createdAt" not in data:
        data["createdAt"] = datetime.utcnow()
    
    result = await collection.insert_one(data)
    data["id"] = str(result.inserted_id)
    
    return data


async def update_document(
    collection_name: str,
    doc_id: str,
    data: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """Update a document in any collection"""
    if not is_valid_objectid(doc_id):
        return None
    
    collection = db[collection_name]
    
    # Add update timestamp
    data["updatedAt"] = datetime.utcnow()
    
    result = await collection.find_one_and_update(
        {"_id": ObjectId(doc_id)},
        {"$set": data},
        return_document=True
    )
    
    return map_document(result) if result else None


async def delete_document(collection_name: str, doc_id: str) -> bool:
    """Delete a document from any collection"""
    if not is_valid_objectid(doc_id):
        return False
    
    collection = db[collection_name]
    result = await collection.delete_one({"_id": ObjectId(doc_id)})
    
    return result.deleted_count > 0


async def count_documents(
    collection_name: str,
    filter_dict: Optional[Dict[str, Any]] = None
) -> int:
    """Count documents in any collection"""
    collection = db[collection_name]
    query = filter_dict or {}
    return await collection.count_documents(query)


# ===== Specialized Queries =====

async def get_recent_announcements(limit: int = 10) -> List[Dict[str, Any]]:
    """Get recent announcements sorted by date"""
    return await get_all(
        "announcements",
        sort_by="createdAt",
        limit=limit
    )


async def get_announcements_by_category(category: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Get announcements filtered by category"""
    return await get_all(
        "announcements",
        filter_dict={"category": category},
        sort_by="createdAt",
        limit=limit
    )


async def get_upcoming_events(limit: int = 10) -> List[Dict[str, Any]]:
    """Get upcoming events"""
    return await get_all(
        "events",
        filter_dict={"date": {"$gte": datetime.utcnow()}},
        sort_by="date",
        limit=limit
    )


async def get_recent_placements(limit: int = 10) -> List[Dict[str, Any]]:
    """Get recent placement updates"""
    return await get_all(
        "placements",
        sort_by="date",
        limit=limit
    )


async def search_knowledge_base(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Full-text search in knowledge base"""
    cursor = db.knowledge_base.find(
        {"$text": {"$search": query}},
        {"score": {"$meta": "textScore"}}
    ).sort([("score", {"$meta": "textScore"})]).limit(limit)
    
    docs = await cursor.to_list(length=None)
    return map_documents(docs)


async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Get user by email address"""
    user = await db.users.find_one({"email": email})
    return map_document(user) if user else None


async def get_timetable_by_class(class_name: str, semester: str) -> Optional[Dict[str, Any]]:
    """Get timetable for a specific class and semester"""
    timetable = await db.classTimetables.find_one({
        "className": class_name,
        "semester": semester
    })
    return map_document(timetable) if timetable else None


async def get_timetable_by_teacher(teacher_id: str) -> Optional[Dict[str, Any]]:
    """Get timetable for a specific teacher"""
    if not is_valid_objectid(teacher_id):
        return None
    
    timetable = await db.teachers_timetable.find_one({"teacherId": ObjectId(teacher_id)})
    return map_document(timetable) if timetable else None


# ===== ML Training Data Operations =====

async def save_training_data(
    content: str,
    category: str,
    source: str,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Save data for ML model training"""
    data = {
        "content": content,
        "category": category,
        "source": source,
        "metadata": metadata or {},
        "createdAt": datetime.utcnow()
    }
    return await create_document("mlTrainingData", data)


async def get_training_data_by_category(category: str) -> List[Dict[str, Any]]:
    """Get all training data for a specific category"""
    return await get_all(
        "mlTrainingData",
        filter_dict={"category": category}
    )


async def get_all_training_data() -> List[Dict[str, Any]]:
    """Get all ML training data"""
    return await get_all("mlTrainingData")


# Export commonly used functions
__all__ = [
    'database',
    'db',
    'connect_db',
    'close_db',
    'create_indexes',
    'seed_database',
    'hash_password',
    'verify_password',
    'map_document',
    'map_documents',
    'is_valid_objectid',
    'to_objectid',
    'get_by_id',
    'get_all',
    'create_document',
    'update_document',
    'delete_document',
    'count_documents',
    'get_recent_announcements',
    'get_announcements_by_category',
    'get_upcoming_events',
    'get_recent_placements',
    'search_knowledge_base',
    'get_user_by_email',
    'get_timetable_by_class',
    'get_timetable_by_teacher',
    'save_training_data',
    'get_training_data_by_category',
    'get_all_training_data'
]
