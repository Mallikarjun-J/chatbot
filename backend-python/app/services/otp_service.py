"""
OTP Service
Generates, stores, and verifies One-Time Passwords
"""

import secrets
import string
from datetime import datetime, timedelta
from typing import Optional
from app.database import get_database
import logging

logger = logging.getLogger(__name__)


class OTPService:
    """
    OTP service for generating and verifying codes
    Stores OTPs in MongoDB with expiration
    """
    
    OTP_LENGTH = 6
    OTP_EXPIRY_MINUTES = 10  # OTP valid for 10 minutes
    RESET_CODE_LENGTH = 6
    RESET_CODE_EXPIRY_MINUTES = 15  # Reset code valid for 15 minutes
    
    @staticmethod
    def generate_otp() -> str:
        """
        Generate a 6-digit OTP
        
        Returns:
            str: 6-digit OTP code
        """
        return ''.join(secrets.choice(string.digits) for _ in range(OTPService.OTP_LENGTH))
    
    @staticmethod
    def generate_reset_code() -> str:
        """
        Generate a 6-digit password reset code
        
        Returns:
            str: 6-digit reset code
        """
        return ''.join(secrets.choice(string.digits) for _ in range(OTPService.RESET_CODE_LENGTH))
    
    @staticmethod
    async def create_otp(user_id: str, email: str, purpose: str = "login") -> str:
        """
        Create and store OTP for a user
        
        Args:
            user_id: User's ID
            email: User's email
            purpose: Purpose of OTP (login, reset, etc.)
            
        Returns:
            str: Generated OTP code
        """
        db = get_database()
        otp_code = OTPService.generate_otp()
        expires_at = datetime.utcnow() + timedelta(minutes=OTPService.OTP_EXPIRY_MINUTES)
        
        # Remove any existing OTPs for this user and purpose
        await db.otps.delete_many({"user_id": user_id, "purpose": purpose})
        
        # Store new OTP
        otp_doc = {
            "user_id": user_id,
            "email": email,
            "otp_code": otp_code,
            "purpose": purpose,
            "created_at": datetime.utcnow(),
            "expires_at": expires_at,
            "is_used": False,
            "attempts": 0
        }
        
        await db.otps.insert_one(otp_doc)
        logger.info(f"OTP created for user {user_id} ({email}) - Purpose: {purpose}")
        
        return otp_code
    
    @staticmethod
    async def verify_otp(
        user_id: str, 
        otp_code: str, 
        purpose: str = "login",
        max_attempts: int = 3
    ) -> bool:
        """
        Verify OTP code for a user
        
        Args:
            user_id: User's ID
            otp_code: OTP code to verify
            purpose: Purpose of OTP
            max_attempts: Maximum verification attempts allowed
            
        Returns:
            bool: True if OTP is valid, False otherwise
        """
        db = get_database()
        
        # Find OTP
        otp_doc = await db.otps.find_one({
            "user_id": user_id,
            "purpose": purpose,
            "is_used": False
        })
        
        if not otp_doc:
            logger.warning(f"No active OTP found for user {user_id}")
            return False
        
        # Check expiration
        if datetime.utcnow() > otp_doc["expires_at"]:
            logger.warning(f"Expired OTP for user {user_id}")
            await db.otps.delete_one({"_id": otp_doc["_id"]})
            return False
        
        # Check attempts
        if otp_doc["attempts"] >= max_attempts:
            logger.warning(f"Too many attempts for user {user_id}")
            await db.otps.delete_one({"_id": otp_doc["_id"]})
            return False
        
        # Verify code
        if otp_doc["otp_code"] == otp_code:
            # Mark as used
            await db.otps.update_one(
                {"_id": otp_doc["_id"]},
                {"$set": {"is_used": True}}
            )
            logger.info(f"OTP verified successfully for user {user_id}")
            return True
        else:
            # Increment attempts
            await db.otps.update_one(
                {"_id": otp_doc["_id"]},
                {"$inc": {"attempts": 1}}
            )
            logger.warning(f"Invalid OTP attempt for user {user_id}")
            return False
    
    @staticmethod
    async def create_reset_code(email: str) -> Optional[str]:
        """
        Create and store password reset code
        
        Args:
            email: User's email
            
        Returns:
            str: Generated reset code, or None if user not found
        """
        db = get_database()
        
        # Check if user exists
        user = await db.users.find_one({"email": email})
        if not user:
            logger.warning(f"Reset code requested for non-existent email: {email}")
            return None
        
        reset_code = OTPService.generate_reset_code()
        expires_at = datetime.utcnow() + timedelta(minutes=OTPService.RESET_CODE_EXPIRY_MINUTES)
        
        # Remove any existing reset codes for this email
        await db.password_resets.delete_many({"email": email})
        
        # Store new reset code
        reset_doc = {
            "user_id": str(user["_id"]),
            "email": email,
            "reset_code": reset_code,
            "created_at": datetime.utcnow(),
            "expires_at": expires_at,
            "is_used": False,
            "attempts": 0
        }
        
        await db.password_resets.insert_one(reset_doc)
        logger.info(f"Password reset code created for {email}")
        
        return reset_code
    
    @staticmethod
    async def verify_reset_code(
        email: str, 
        reset_code: str,
        max_attempts: int = 3
    ) -> bool:
        """
        Verify password reset code
        
        Args:
            email: User's email
            reset_code: Reset code to verify
            max_attempts: Maximum verification attempts allowed
            
        Returns:
            bool: True if code is valid, False otherwise
        """
        db = get_database()
        
        # Find reset code
        reset_doc = await db.password_resets.find_one({
            "email": email,
            "is_used": False
        })
        
        if not reset_doc:
            logger.warning(f"No active reset code found for {email}")
            return False
        
        # Check expiration
        if datetime.utcnow() > reset_doc["expires_at"]:
            logger.warning(f"Expired reset code for {email}")
            await db.password_resets.delete_one({"_id": reset_doc["_id"]})
            return False
        
        # Check attempts
        if reset_doc["attempts"] >= max_attempts:
            logger.warning(f"Too many reset attempts for {email}")
            await db.password_resets.delete_one({"_id": reset_doc["_id"]})
            return False
        
        # Verify code
        if reset_doc["reset_code"] == reset_code:
            # Don't mark as used yet - will be marked when password is actually reset
            # Just reset attempts counter on successful verification
            await db.password_resets.update_one(
                {"_id": reset_doc["_id"]},
                {"$set": {"attempts": 0}}
            )
            logger.info(f"Reset code verified successfully for {email}")
            return True
        else:
            # Increment attempts
            await db.password_resets.update_one(
                {"_id": reset_doc["_id"]},
                {"$inc": {"attempts": 1}}
            )
            logger.warning(f"Invalid reset code attempt for {email}")
            return False
    
    @staticmethod
    async def cleanup_expired() -> int:
        """
        Remove expired OTPs and reset codes from database
        Should be called periodically (e.g., via cron job)
        
        Returns:
            int: Number of expired records removed
        """
        db = get_database()
        now = datetime.utcnow()
        
        # Clean expired OTPs
        otp_result = await db.otps.delete_many({"expires_at": {"$lt": now}})
        
        # Clean expired reset codes
        reset_result = await db.password_resets.delete_many({"expires_at": {"$lt": now}})
        
        total_removed = otp_result.deleted_count + reset_result.deleted_count
        
        if total_removed > 0:
            logger.info(f"Cleaned up {total_removed} expired OTP/reset codes")
        
        return total_removed


# Create singleton instance
otp_service = OTPService()
