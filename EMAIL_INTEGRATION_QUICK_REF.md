# Email Integration - Quick Reference

## 🚀 Quick Start

### 1. Install Dependencies
```powershell
cd backend-python
pip install aiosmtplib==3.0.1 jinja2==3.1.3
```

### 2. Configure Gmail (Easiest Option)

1. Enable 2FA: https://myaccount.google.com/security
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Update `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password  # Not your regular password!
FROM_EMAIL=your-email@gmail.com
FROM_NAME=CampusAura
```

### 3. Test It!
- Login as admin → OTP sent to email
- Click "Forgot Password" → Reset code sent to email
- Create new user → Welcome email sent automatically

---

## 📧 Email Types

| Email Type | Trigger | Contains | Expires |
|------------|---------|----------|---------|
| OTP | Admin login | 6-digit code | 10 min |
| Password Reset | Forgot password | 6-digit code | 15 min |
| Welcome | New user created | Login credentials | Never |

---

## 🔑 API Endpoints

### Send OTP (Admin Login)
```
POST /api/auth/send-otp
Body: { email: string, password: string }
Response: { success: true, user_id: string }
```

### Verify OTP
```
POST /api/auth/verify-otp
Body: { user_id: string, otp_code: string }
Response: { token: string, user: object }
```

### Request Password Reset
```
POST /api/auth/forgot-password
Body: { email: string }
Response: { success: true, message: string }
```

### Verify Reset Code
```
POST /api/auth/verify-reset-code
Body: { email: string, reset_code: string }
Response: { success: true, message: string }
```

### Reset Password
```
POST /api/auth/reset-password
Body: { email: string, reset_code: string, new_password: string }
Response: { success: true, message: string }
```

---

## 🗄️ Database Collections

### `otps` Collection
```javascript
{
  user_id: "ObjectId",
  email: "user@example.com",
  otp_code: "123456",
  purpose: "login",
  expires_at: ISODate("2025-..."),
  is_used: false,
  attempts: 0
}
```

### `password_resets` Collection
```javascript
{
  user_id: "ObjectId",
  email: "user@example.com",
  reset_code: "987654",
  expires_at: ISODate("2025-..."),
  is_used: false,
  attempts: 0
}
```

---

## 🛠️ Troubleshooting

### Email not sending?

**Gmail:**
```env
# ✅ Correct - App Password
SMTP_PASSWORD=abcd efgh ijkl mnop

# ❌ Wrong - Regular password
SMTP_PASSWORD=MyPassword123
```

**Outlook:**
```env
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
```

**Check logs:**
```powershell
# Start backend and watch for:
INFO: Email sent successfully to user@example.com
ERROR: Failed to send email to user@example.com: <error>
```

---

## 🔧 Common Fixes

| Issue | Solution |
|-------|----------|
| "Authentication failed" | Use App Password for Gmail, not regular password |
| "Connection timeout" | Check firewall, try port 465 instead of 587 |
| "Invalid OTP" | Code expired (10 min) or exceeded 3 attempts |
| "Email in spam" | Add FROM_EMAIL to contacts, check SPF/DKIM |

---

## 📝 File Changes Summary

### New Files Created:
- `backend-python/app/services/email_service.py` - Email sending service
- `backend-python/app/services/otp_service.py` - OTP/reset code management

### Modified Files:
- `backend-python/requirements.txt` - Added email dependencies
- `backend-python/app/config.py` - Added SMTP configuration
- `backend-python/app/routes/auth.py` - Added email endpoints
- `backend-python/app/routes/users.py` - Added welcome email
- `backend-python/.env` - Added SMTP settings
- `frontend/src/components/LoginComponent.tsx` - Integrated real APIs

---

## ⚡ Testing Checklist

- [ ] Backend running: `python main.py`
- [ ] Frontend running: `npm run dev`
- [ ] `.env` configured with valid SMTP credentials
- [ ] Admin login sends OTP email
- [ ] OTP verification works
- [ ] Password reset sends code
- [ ] Reset code verification works
- [ ] New password can be set
- [ ] Welcome email sent when creating users

---

## 🎨 Customization

### Change OTP Expiry Time
`backend-python/app/services/otp_service.py`:
```python
OTP_EXPIRY_MINUTES = 10  # Change to desired minutes
```

### Change Email Styling
`backend-python/app/services/email_service.py`:
- Edit HTML templates in each `send_*_email()` method
- Modify colors, fonts, layout

### Change "From" Name
`.env`:
```env
FROM_NAME=My Campus System
```

---

## 📊 Email Templates Preview

### OTP Email:
```
┌─────────────────────────┐
│  🔐 Admin Login         │
│     Verification        │
├─────────────────────────┤
│ Hello Admin,            │
│                         │
│ Your OTP is:            │
│     ┌───────────┐       │
│     │  123456   │       │
│     └───────────┘       │
│                         │
│ Valid for 10 minutes    │
└─────────────────────────┘
```

### Password Reset Email:
```
┌─────────────────────────┐
│  🔑 Password Reset      │
│     Request             │
├─────────────────────────┤
│ Hello User,             │
│                         │
│ Your reset code is:     │
│     ┌───────────┐       │
│     │  987654   │       │
│     └───────────┘       │
│                         │
│ Valid for 15 minutes    │
└─────────────────────────┘
```

---

## 🔐 Security Notes

- ✅ Codes expire automatically
- ✅ Maximum 3 verification attempts
- ✅ Codes are one-time use
- ✅ TLS encryption for email transmission
- ✅ Cryptographically secure code generation
- ✅ Codes stored with timestamps
- ✅ Automatic cleanup of expired codes

---

**Need help? Check the full guide: `EMAIL_SETUP_GUIDE.md`**
