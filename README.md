# CampusAura - Campus Management System

A full-stack campus management system with AI-powered features.

## Project Structure

```
campusaura/
├── frontend/           # React + TypeScript frontend
│   ├── src/
│   │   ├── components/ # UI components
│   │   └── ...
│   └── package.json
│
├── backend/            # Node.js + Express backend
│   ├── src/
│   │   ├── server.mjs          # API server
│   │   ├── database.mjs        # Database operations
│   │   └── advanced-scraper.mjs # Web scraping
│   └── package.json
│
└── README.md          # This file
```

## Quick Start

### 1. Start Backend
```powershell
cd backend
npm install
npm start
# Server runs on http://localhost:3001
```

### 2. Start Frontend
```powershell
cd frontend
npm install
npm run dev
# App runs on http://localhost:3000
```

## Features

### Backend
✅ RESTful API
✅ JWT Authentication
✅ MongoDB Database
✅ AI Chatbot (Google Gemini)
✅ Advanced Web Scraping
✅ File Upload Management

### Frontend
✅ Role-based Dashboards
✅ AI Chat Interface
✅ Announcement System
✅ Document Management
✅ Web Scraping UI
✅ Dark/Light Theme

## Tech Stack

**Frontend:**
- React 18
- TypeScript
- Vite
- Lucide Icons

**Backend:**
- Node.js
- Express
- MongoDB
- Google Gemini AI
- Cheerio (web scraping)

## Default Login

Email: admin@campus.com
Password: password123

## Documentation

- Frontend: See frontend/README.md
- Backend: See backend/README.md
