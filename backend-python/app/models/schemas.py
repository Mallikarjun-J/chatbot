"""
Pydantic models for data validation and serialization
"""

from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
from bson import ObjectId


class PyObjectId(ObjectId):
    """Custom ObjectId type for Pydantic v2"""
    
    @classmethod
    def __get_pydantic_core_schema__(cls, source_type, handler):
        from pydantic_core import core_schema
        return core_schema.union_schema([
            core_schema.is_instance_schema(ObjectId),
            core_schema.chain_schema([
                core_schema.str_schema(),
                core_schema.no_info_plain_validator_function(cls.validate),
            ])
        ])
    
    @classmethod
    def validate(cls, v):
        if isinstance(v, ObjectId):
            return v
        if isinstance(v, str) and ObjectId.is_valid(v):
            return ObjectId(v)
        raise ValueError(f"Invalid ObjectId: {v}")


class UserRole(str, Enum):
    """User roles"""
    ADMIN = "Admin"
    TEACHER = "Teacher"
    STUDENT = "Student"


class User(BaseModel):
    """User model"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    name: str
    email: EmailStr
    role: UserRole
    password: str
    avatarUrl: Optional[str] = None
    branch: Optional[str] = None  # For students
    section: Optional[str] = None  # For students
    department: Optional[str] = None  # For teachers
    employeeId: Optional[str] = None  # For teachers

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str}


class UserResponse(BaseModel):
    """User response without password"""
    id: str
    name: str
    email: str
    role: UserRole
    avatarUrl: Optional[str] = None
    branch: Optional[str] = None
    section: Optional[str] = None
    department: Optional[str] = None
    employeeId: Optional[str] = None


class Announcement(BaseModel):
    """Announcement model"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    title: str
    content: str
    date: datetime = Field(default_factory=datetime.utcnow)
    eventDate: Optional[str] = None
    eventTime: Optional[str] = None
    location: Optional[str] = None
    category: Optional[str] = "announcement"
    source: Optional[str] = None
    createdBy: Optional[PyObjectId] = None
    createdByEmail: Optional[str] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat()}


class Document(BaseModel):
    """Document model"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    filename: str
    originalname: str
    mimetype: str
    size: int
    uploadDate: datetime = Field(default_factory=datetime.utcnow)
    type: str
    uploadedBy: Optional[str] = None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat()}


class TimetableSlot(BaseModel):
    """Timetable slot"""
    time: str
    subject: str
    teacher: Optional[str] = None
    class_: Optional[str] = Field(alias="class", default=None)
    room: Optional[str] = None


class ClassTimetable(BaseModel):
    """Class timetable model"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    branch: str
    section: str
    semester: Optional[str] = None
    days: Dict[str, List[TimetableSlot]]
    filePath: Optional[str] = None
    uploadedBy: Optional[str] = None
    uploadDate: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat()}


class KnowledgeBase(BaseModel):
    """Knowledge base entry model"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    url: str
    pageTitle: str
    summary: str
    content: str
    category: str = "general"
    isPlacementData: bool = False
    placementScore: int = 0
    priority: str = "normal"
    metadata: Optional[Dict[str, Any]] = None
    embeddings: Optional[List[float]] = None  # Vector embeddings for semantic search
    scrapedAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat()}


class MLTrainingData(BaseModel):
    """ML training data model"""
    id: Optional[PyObjectId] = Field(alias="_id", default=None)
    text: str
    label: str  # announcement, placement, event, examination, holiday, document
    embeddings: Optional[List[float]] = None
    source: str  # 'manual', 'scraped', 'feedback'
    confidence: float = 1.0
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
        json_encoders = {ObjectId: str, datetime: lambda v: v.isoformat()}
