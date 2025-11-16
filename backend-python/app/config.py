import os
from typing import Optional
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application configuration settings"""
    
    # Server
    PORT: int = 3001
    HOST: str = "0.0.0.0"
    ENVIRONMENT: str = "development"
    
    # Security
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_IN: int = 86400  # 24 hours
    
    # Database
    MONGODB_URI: str = "mongodb://localhost:27017"
    DB_NAME: str = "campus"
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"
    
    # AI
    GEMINI_API_KEY: str
    OPENAI_API_KEY: Optional[str] = None
    
    # College Information
    COLLEGE_NAME: str = "College"
    COLLEGE_LOCATION: str = "India"
    
    # Email Configuration
    SMTP_HOST: str = "smtp.gmail.com"  # Default to Gmail
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    FROM_EMAIL: str = ""
    FROM_NAME: str = "CampusAura"
    
    # File Upload
    MAX_FILE_SIZE: int = 5 * 1024 * 1024  # 5MB
    UPLOAD_DIR: str = "uploads"
    
    # ML Models
    MODEL_DIR: str = "app/ml/models"
    EMBEDDINGS_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    CLASSIFIER_MODEL: str = "app/ml/models/content_classifier.pkl"
    
    # Rate Limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    AUTH_RATE_LIMIT_PER_MINUTE: int = 5
    
    class Config:
        env_file = ".env"
        case_sensitive = True
    
    @property
    def cors_origins_list(self) -> list[str]:
        """Convert comma-separated CORS origins to list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


# Global settings instance
settings = get_settings()
