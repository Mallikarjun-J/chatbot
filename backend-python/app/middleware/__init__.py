"""
Middleware for authentication, authorization, and request processing.
"""

from .auth import get_current_user, create_access_token

__all__ = ['get_current_user', 'create_access_token']
