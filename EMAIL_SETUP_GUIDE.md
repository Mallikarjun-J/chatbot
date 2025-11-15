# Email Integration Setup Guide

## Overview
Your CampusAura application now has **real email integration** for:
- ✅ Admin OTP authentication
- ✅ Password reset flow
- ✅ Welcome emails for new users

## 📋 Setup Instructions

### Step 1: Install New Dependencies

Navigate to the Python backend directory and install new packages:

```powershell
cd backend-python
pip install aiosmtplib==3.0.1 jinja2==3.1.3
```

Or install all dependencies:
```powershell
pip install -r requirements.txt
```

### Step 2: Configure Email Settings

Open `.env` file in `backend-python/` directory and update the email configuration:

#### For Gmail (Recommended):

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate App Password**:
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer"
   - Copy the 16-character password

3. **Update .env file**:
```env
# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
FROM_EMAIL=your-email@gmail.com
FROM_NAME=CampusAura
```

#### For Outlook/Hotmail:

```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USERNAME=your-email@outlook.com
SMTP_PASSWORD=your-password
FROM_EMAIL=your-email@outlook.com
FROM_NAME=CampusAura
```

#### For Custom SMTP Server:

```env
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587  # or 465 for SSL
SMTP_USERNAME=your-username
SMTP_PASSWORD=your-password
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=CampusAura
```

### Step 3: Verify Configuration

The configuration is stored in `.env` file. Make sure:
- No extra spaces in values
- SMTP_PASSWORD is correct (for Gmail, use App Password, not regular password)
- FROM_EMAIL matches SMTP_USERNAME

## 🚀 Features Implemented

### 1. Admin OTP Login

**How it works:**
- Admin logs in with email/password
- System sends 6-digit OTP to admin's email
- Admin enters OTP to complete login
- OTP expires after 10 minutes
- Maximum 3 verification attempts

**Backend API:**
```
POST /api/auth/send-otp
Body: { email, password }
Response: { success: true, message, user_id }

POST /api/auth/verify-otp
Body: { user_id, otp_code }
Response: { token, user }
```

### 2. Password Reset Flow

**How it works:**
- User clicks "Forgot Password"
- Enters email address
- System sends 6-digit reset code to email
- User verifies code
- User sets new password
- Reset code expires after 15 minutes
- Maximum 3 verification attempts

**Backend API:**
```
POST /api/auth/forgot-password
Body: { email }
Response: { success: true, message }

POST /api/auth/verify-reset-code
Body: { email, reset_code }
Response: { success: true, message }

POST /api/auth/reset-password
Body: { email, reset_code, new_password }
Response: { success: true, message }
```

### 3. Welcome Emails

**How it works:**
- Admin creates new user account
- System automatically sends welcome email
- Email contains login credentials
- Users are prompted to change password on first login

**Email includes:**
- Account details (email, role)
- Default password: `password123`
- Security reminder to change password

## 📧 Email Templates

### OTP Email
- Professional design with gradient header
- Clear OTP display (6-digit code)
- Security warnings
- 10-minute expiry notice

### Password Reset Email
- Distinct styling to differentiate from OTP
- 6-digit reset code
- 15-minute expiry notice
- Security recommendations

### Welcome Email
- Warm greeting
- Account details
- Default credentials
- Password change reminder

## 🗄️ Database Collections

Two new MongoDB collections are automatically created:

### 1. `otps` Collection
Stores OTP codes for admin login:
```javascript
{
  user_id: String,
  email: String,
  otp_code: String,
  purpose: "login",
  created_at: Date,
  expires_at: Date,
  is_used: Boolean,
  attempts: Number
}
```

### 2. `password_resets` Collection
Stores password reset codes:
```javascript
{
  user_id: String,
  email: String,
  reset_code: String,
  created_at: Date,
  expires_at: Date,
  is_used: Boolean,
  attempts: Number
}
```

**Auto-cleanup:** Expired codes are automatically marked for deletion.

## 🧪 Testing

### Test Admin OTP Login:

1. Start backend: `cd backend-python && python main.py`
2. Start frontend: `cd frontend && npm run dev`
3. Go to login page
4. Use admin credentials:
   - Email: `admin@campusaura.com`
   - Password: `admin123`
5. Check your email inbox for OTP
6. Enter OTP to complete login

### Test Password Reset:

1. Click "Forgot Password" on login page
2. Enter your email
3. Check inbox for reset code
4. Enter 6-digit code
5. Set new password
6. Login with new password

### Test Welcome Email:

1. Login as admin
2. Go to User Management
3. Create new user
4. New user receives welcome email automatically

## 🔧 Troubleshooting

### Issue: Email not sending

**Check:**
1. `.env` file has correct SMTP settings
2. For Gmail: Using App Password, not regular password
3. Internet connection is active
4. SMTP server is accessible (not blocked by firewall)

**Debug:**
```python
# Check backend logs for errors
# Look for lines containing "Email sent" or "Failed to send email"
```

### Issue: "Failed to send OTP email"

**Solutions:**
1. Verify SMTP credentials in `.env`
2. For Gmail: Ensure 2FA is enabled and App Password is generated
3. Check if SMTP port 587 is open
4. Try port 465 with SSL if 587 doesn't work

### Issue: OTP/Reset code expired

**Expected behavior:**
- OTP expires after 10 minutes
- Reset code expires after 15 minutes
- Generate new code if expired

### Issue: "Invalid OTP" even with correct code

**Check:**
1. Code hasn't expired
2. Not exceeding 3 attempts
3. User ID matches (for OTP)
4. Email matches (for reset code)

## 📝 Configuration Options

### Customize Expiry Times

Edit `backend-python/app/services/otp_service.py`:

```python
class OTPService:
    OTP_EXPIRY_MINUTES = 10       # Change OTP expiry
    RESET_CODE_EXPIRY_MINUTES = 15  # Change reset code expiry
```

### Customize Email Templates

Edit `backend-python/app/services/email_service.py`:
- Modify HTML templates in `send_otp_email()`
- Modify HTML templates in `send_password_reset_email()`
- Modify HTML templates in `send_welcome_email()`

### Change Maximum Attempts

Edit `backend-python/app/routes/auth.py`:

```python
# In verify_otp endpoint:
is_valid = await otp_service.verify_otp(
    user_id=request.user_id,
    otp_code=request.otp_code,
    purpose="login",
    max_attempts=3  # Change this number
)
```

## 🔐 Security Features

1. **Secure Code Generation**: Uses Python's `secrets` module for cryptographically strong random codes
2. **Hashed Storage**: OTP and reset codes stored with timestamps
3. **Expiration**: Codes automatically expire after set time
4. **Attempt Limiting**: Maximum 3 attempts before code is invalidated
5. **One-Time Use**: Codes marked as used after successful verification
6. **TLS Encryption**: Email transmission uses STARTTLS

## 📊 Email Delivery Statistics

To check email delivery:

```python
# Backend logs will show:
INFO: OTP created for user <id> (<email>) - Purpose: login
INFO: Email sent successfully to <email>
ERROR: Failed to send email to <email>: <error details>
```

## 🎯 Next Steps

**Optional Enhancements:**

1. **Email Templates with Logo**:
   - Add your campus logo to email templates
   - Customize colors to match your brand

2. **Email Notifications**:
   - Notify users of new announcements
   - Send timetable updates
   - Alert on document uploads

3. **Scheduled Emails**:
   - Batch send announcements
   - Weekly/monthly digests
   - Reminder emails

4. **Email Analytics**:
   - Track open rates
   - Monitor delivery success
   - Log email history

## 📞 Support

If you encounter issues:
1. Check backend logs for error messages
2. Verify `.env` configuration
3. Test SMTP connection manually
4. Ensure all dependencies are installed

## ✅ Checklist

- [ ] Install new dependencies (`aiosmtplib`, `jinja2`)
- [ ] Configure SMTP settings in `.env`
- [ ] For Gmail: Enable 2FA and generate App Password
- [ ] Test admin OTP login
- [ ] Test password reset flow
- [ ] Test welcome email on user creation
- [ ] Verify emails are delivered to inbox (not spam)
- [ ] Customize email templates (optional)

---

**Your email integration is ready! 📧**

All authentication flows now use real email delivery instead of mock codes.
