# CampusAura Backend

RESTful API server for CampusAura campus management system.

## Features
- JWT Authentication
- MongoDB Database
- AI Chatbot (Google Gemini)
- Web Scraping (Basic + Advanced Deep Scraping)
- File Upload Management
- Rate Limiting & Security

## Setup

1. Install dependencies:
```powershell
npm install
```

2. Configure environment (.env.local):
```
PORT=3001
JWT_SECRET=your-secret-key
GEMINI_API_KEY=your-gemini-key
MONGODB_URI=mongodb://localhost:27017
```

3. Start server:
```powershell
npm start
# or for development with auto-reload:
npm run dev
```

## API Endpoints

- POST /api/auth/login - User authentication
- GET/POST /api/announcements - Manage announcements
- GET/POST /api/users - User management
- POST /api/ai/chat - AI chatbot
- POST /api/scrape/deep - Deep web scraping
- GET /api/health - Health check

## Project Structure
```
backend/
├── src/
│   ├── server.mjs           # Main server file
│   ├── database.mjs         # Database operations
│   ├── mongo-client.mjs     # MongoDB connection
│   └── advanced-scraper.mjs # Web scraping engine
├── uploads/                  # Uploaded files
└── package.json
```
