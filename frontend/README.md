# CampusAura Frontend

React + TypeScript frontend application for CampusAura.

## Features
- Modern React UI with TypeScript
- Role-based Dashboards (Admin/Teacher/Student)
- AI Chatbot Interface
- Announcement Management
- Document Upload/Download
- Web Scraping Interface
- Dark/Light Theme

## Setup

1. Install dependencies:
```powershell
npm install
```

2. Start development server:
```powershell
npm run dev
```

3. Build for production:
```powershell
npm run build
```

## Project Structure
```
frontend/
├── src/
│   ├── components/          # React components
│   ├── App.tsx             # Main app component
│   ├── index.tsx           # Entry point
│   ├── types.ts            # TypeScript types
│   └── vite.config.ts      # Vite configuration
├── index.html
└── package.json
```

## Components
- AdminDashboard - Admin management interface
- StudentDashboard - Student portal
- TeacherDashboard - Teacher portal
- ChatComponent - AI chatbot
- WebScrapingView - Web scraping interface
- And more...
