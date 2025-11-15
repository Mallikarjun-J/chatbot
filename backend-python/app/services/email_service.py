"""
Email Service
Handles sending emails via SMTP (Gmail, Outlook, custom servers)
"""

import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jinja2 import Template
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class EmailService:
    """
    Email service for sending OTP, password reset, and notifications
    Supports Gmail, Outlook, and custom SMTP servers
    """
    
    def __init__(self):
        self.smtp_host = settings.SMTP_HOST
        self.smtp_port = settings.SMTP_PORT
        self.smtp_username = settings.SMTP_USERNAME
        self.smtp_password = settings.SMTP_PASSWORD
        self.from_email = settings.FROM_EMAIL
        self.from_name = settings.FROM_NAME
        
    async def send_email(
        self, 
        to_email: str, 
        subject: str, 
        html_content: str,
        text_content: str = None
    ) -> bool:
        """
        Send an email using SMTP
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML body of the email
            text_content: Plain text alternative (optional)
            
        Returns:
            bool: True if email sent successfully, False otherwise
        """
        try:
            # Create message
            message = MIMEMultipart("alternative")
            message["From"] = f"{self.from_name} <{self.from_email}>"
            message["To"] = to_email
            message["Subject"] = subject
            
            # Add plain text version
            if text_content:
                text_part = MIMEText(text_content, "plain")
                message.attach(text_part)
            
            # Add HTML version
            html_part = MIMEText(html_content, "html")
            message.attach(html_part)
            
            # Send email
            await aiosmtplib.send(
                message,
                hostname=self.smtp_host,
                port=self.smtp_port,
                username=self.smtp_username,
                password=self.smtp_password,
                start_tls=True
            )
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {str(e)}")
            return False
    
    async def send_otp_email(self, to_email: str, otp_code: str, user_name: str, role: str = "admin") -> bool:
        """
        Send OTP verification email
        
        Args:
            to_email: User's email address
            otp_code: 6-digit OTP code
            user_name: User's name
            role: User's role (student, teacher, admin)
            
        Returns:
            bool: True if email sent successfully
        """
        # Capitalize role for display
        role_display = role.capitalize()
        
        # Role-specific subject and greeting
        role_subjects = {
            "student": "Your CampusAura Student Login OTP",
            "teacher": "Your CampusAura Teacher Login OTP",
            "admin": "Your CampusAura Admin Login OTP"
        }
        
        role_descriptions = {
            "student": "CampusAura Student",
            "teacher": "CampusAura Teacher",
            "admin": "CampusAura Admin"
        }
        
        subject = role_subjects.get(role.lower(), "Your CampusAura Login OTP")
        account_type = role_descriptions.get(role.lower(), "CampusAura")
        
        html_template = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .otp-box { background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
                .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
                .warning { color: #e74c3c; font-size: 14px; margin-top: 20px; }
                .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔐 {{ role_display }} Login Verification</h1>
                </div>
                <div class="content">
                    <h2>Hello {{ user_name }},</h2>
                    <p>You are attempting to log in to your <strong>{{ account_type }}</strong> account.</p>
                    <p>Please use the following One-Time Password (OTP) to complete your login:</p>
                    
                    <div class="otp-box">
                        <div class="otp-code">{{ otp_code }}</div>
                    </div>
                    
                    <p><strong>This OTP is valid for 10 minutes.</strong></p>
                    
                    <div class="warning">
                        <p>⚠️ <strong>Security Notice:</strong></p>
                        <ul style="text-align: left;">
                            <li>Never share this OTP with anyone</li>
                            <li>CampusAura staff will never ask for your OTP</li>
                            <li>If you didn't request this, please contact your administrator immediately</li>
                        </ul>
                    </div>
                </div>
                <div class="footer">
                    <p>This is an automated message from CampusAura. Please do not reply to this email.</p>
                    <p>&copy; 2025 CampusAura - Campus Management System</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Hello {user_name},
        
        You are attempting to log in to your {account_type} account.
        
        Your One-Time Password (OTP) is: {otp_code}
        
        This OTP is valid for 10 minutes.
        
        Security Notice:
        - Never share this OTP with anyone
        - If you didn't request this, please contact your administrator immediately
        
        CampusAura - Campus Management System
        """
        
        template = Template(html_template)
        html_content = template.render(
            user_name=user_name, 
            otp_code=otp_code,
            role_display=role_display,
            account_type=account_type
        )
        
        return await self.send_email(to_email, subject, html_content, text_content)
    
    async def send_password_reset_email(
        self, 
        to_email: str, 
        reset_code: str, 
        user_name: str
    ) -> bool:
        """
        Send password reset email with verification code
        
        Args:
            to_email: User's email address
            reset_code: 6-digit reset code
            user_name: User's name
            
        Returns:
            bool: True if email sent successfully
        """
        subject = "Reset Your CampusAura Password"
        
        html_template = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .code-box { background: white; border: 2px solid #f5576c; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
                .reset-code { font-size: 32px; font-weight: bold; color: #f5576c; letter-spacing: 8px; }
                .warning { color: #e74c3c; font-size: 14px; margin-top: 20px; }
                .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔑 Password Reset Request</h1>
                </div>
                <div class="content">
                    <h2>Hello {{ user_name }},</h2>
                    <p>We received a request to reset your <strong>CampusAura</strong> account password.</p>
                    <p>Please use the following verification code to proceed with password reset:</p>
                    
                    <div class="code-box">
                        <div class="reset-code">{{ reset_code }}</div>
                    </div>
                    
                    <p><strong>This code is valid for 15 minutes.</strong></p>
                    
                    <div class="warning">
                        <p>⚠️ <strong>Security Notice:</strong></p>
                        <ul style="text-align: left;">
                            <li>If you didn't request this password reset, please ignore this email</li>
                            <li>Your password will remain unchanged unless you complete the reset process</li>
                            <li>Never share this code with anyone</li>
                        </ul>
                    </div>
                </div>
                <div class="footer">
                    <p>This is an automated message from CampusAura. Please do not reply to this email.</p>
                    <p>&copy; 2025 CampusAura - Campus Management System</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Hello {user_name},
        
        We received a request to reset your CampusAura account password.
        
        Your password reset verification code is: {reset_code}
        
        This code is valid for 15 minutes.
        
        Security Notice:
        - If you didn't request this password reset, please ignore this email
        - Your password will remain unchanged unless you complete the reset process
        
        CampusAura - Campus Management System
        """
        
        template = Template(html_template)
        html_content = template.render(user_name=user_name, reset_code=reset_code)
        
        return await self.send_email(to_email, subject, html_content, text_content)
    
    async def send_welcome_email(self, to_email: str, user_name: str, role: str) -> bool:
        """
        Send welcome email to new users
        
        Args:
            to_email: User's email address
            user_name: User's name
            role: User's role (Student, Teacher, Admin)
            
        Returns:
            bool: True if email sent successfully
        """
        subject = "Welcome to CampusAura!"
        
        html_template = """
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                .info-box { background: white; border-left: 4px solid #667eea; padding: 15px; margin: 15px 0; }
                .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎓 Welcome to CampusAura!</h1>
                </div>
                <div class="content">
                    <h2>Hello {{ user_name }},</h2>
                    <p>Your account has been successfully created on <strong>CampusAura</strong>!</p>
                    
                    <div class="info-box">
                        <p><strong>Account Details:</strong></p>
                        <p>📧 Email: {{ to_email }}</p>
                        <p>👤 Role: {{ role }}</p>
                        <p>🔐 Default Password: <code>password123</code></p>
                    </div>
                    
                    <p><strong>⚠️ Important:</strong> Please change your password after your first login for security.</p>
                    
                    <p>You can now access the CampusAura platform and explore all the features available to you.</p>
                </div>
                <div class="footer">
                    <p>This is an automated message from CampusAura.</p>
                    <p>&copy; 2025 CampusAura - Campus Management System</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        text_content = f"""
        Hello {user_name},
        
        Your account has been successfully created on CampusAura!
        
        Account Details:
        - Email: {to_email}
        - Role: {role}
        - Default Password: password123
        
        ⚠️ Important: Please change your password after your first login for security.
        
        CampusAura - Campus Management System
        """
        
        template = Template(html_template)
        html_content = template.render(
            user_name=user_name, 
            to_email=to_email, 
            role=role
        )
        
        return await self.send_email(to_email, subject, html_content, text_content)


# Create singleton instance
email_service = EmailService()
