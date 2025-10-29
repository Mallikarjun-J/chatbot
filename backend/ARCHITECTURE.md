# Backend Modular Architecture

## Overview
The backend has been refactored from a monolithic 1400-line `server.mjs` file into a clean, modular architecture following best practices for maintainability and scalability.

## Directory Structure

```
backend/
├── src/
│   ├── config/              # Configuration management
│   │   └── index.mjs        # Environment variables, app config
│   ├── middleware/          # Express middleware
│   │   └── auth.mjs         # JWT authentication & validation
│   ├── controllers/         # Request handlers (business logic)
│   │   ├── authController.mjs
│   │   ├── announcementsController.mjs
│   │   ├── usersController.mjs
│   │   ├── documentsController.mjs
│   │   ├── aiController.mjs
│   │   └── scrapingController.mjs
│   ├── routes/              # API route definitions
│   │   ├── auth.mjs         # POST /api/auth/login
│   │   ├── announcements.mjs # CRUD /api/announcements
│   │   ├── users.mjs        # CRUD /api/users
│   │   ├── documents.mjs    # CRUD /api/documents
│   │   ├── ai.mjs           # POST /api/chat
│   │   └── scraping.mjs     # POST /api/scrape-announcements, /api/deep-scrape
│   ├── services/            # Business logic services
│   │   ├── knowledgeBaseService.mjs  # AI knowledge base building
│   │   └── scrapingService.mjs       # Web scraping utilities
│   ├── server.mjs           # Main application entry (~150 lines)
│   ├── server-old.mjs       # Backup of old monolithic server
│   └── advanced-scraper.mjs # Deep scraping functionality
├── database.mjs             # Database operations
├── mongo-client.mjs         # MongoDB connection
└── uploads/                 # File uploads directory
```

## Architecture Layers

### 1. Configuration Layer (`config/`)
- **Purpose**: Centralized configuration management
- **Files**: 
  - `index.mjs`: Exports config object with environment variables, secrets, database settings

### 2. Middleware Layer (`middleware/`)
- **Purpose**: Request processing, authentication, validation
- **Files**:
  - `auth.mjs`: JWT token verification, user authentication, validation helpers
- **Functions**:
  - `authenticateToken(req, res, next)`: Verifies JWT and loads user from database
  - `validate(req, res, next)`: Express-validator error handling

### 3. Routes Layer (`routes/`)
- **Purpose**: API endpoint definitions with validation rules
- **Pattern**: Each route file handles one resource type
- **Responsibilities**:
  - Define HTTP methods and paths
  - Apply middleware (authentication, validation)
  - Delegate to controllers

### 4. Controllers Layer (`controllers/`)
- **Purpose**: Handle HTTP requests and responses
- **Pattern**: Each controller handles one resource type
- **Responsibilities**:
  - Request validation
  - Permission checking
  - Call services/database
  - Format responses
  - Error handling

### 5. Services Layer (`services/`)
- **Purpose**: Reusable business logic
- **Files**:
  - `knowledgeBaseService.mjs`: Build AI knowledge from announcements
  - `scrapingService.mjs`: Web scraping utilities
- **Pattern**: Pure functions that can be used across controllers

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login with JWT

### Announcements
- `GET /api/announcements` - Get all announcements
- `POST /api/announcements` - Create announcement (teacher/admin)
- `PUT /api/announcements/:id` - Update announcement (teacher/admin)
- `DELETE /api/announcements/:id` - Delete announcement (admin)

### Users
- `GET /api/users` - Get all users (admin)
- `POST /api/users` - Create user (admin)
- `PUT /api/users/:id` - Update user (admin)
- `DELETE /api/users/:id` - Delete user (admin)

### Documents
- `GET /api/documents` - Get all documents
- `POST /api/documents` - Upload document (teacher/admin)
- `GET /api/documents/:id/download` - Download document
- `DELETE /api/documents/:id` - Delete document (admin)

### AI Chatbot
- `POST /api/chat` - Chat with AI assistant

### Web Scraping
- `POST /api/scrape-announcements` - Basic scraping (admin)
- `POST /api/deep-scrape` - Advanced deep scraping (admin)

## Key Improvements

### Before (Monolithic)
- ❌ 1409 lines in single file
- ❌ Hard to navigate and maintain
- ❌ Mixed concerns (routes + logic + services)
- ❌ Difficult to test individual components
- ❌ No clear separation of responsibilities

### After (Modular)
- ✅ ~150 lines in main server.mjs
- ✅ Clear separation of concerns
- ✅ Easy to locate and modify features
- ✅ Testable individual modules
- ✅ Follows MVC-like pattern
- ✅ Scalable architecture

## Development Workflow

### Adding a New Feature
1. **Routes**: Define endpoint in appropriate route file
2. **Controller**: Create handler function in controller
3. **Service** (if needed): Add business logic to service
4. **Middleware** (if needed): Add custom middleware

### Example: Adding a New Endpoint
```javascript
// 1. Add route (routes/announcements.mjs)
router.get('/announcements/trending', getTrendingAnnouncements);

// 2. Create controller (controllers/announcementsController.mjs)
export const getTrendingAnnouncements = async (req, res) => {
    try {
        const trending = await db.getTrendingAnnouncements();
        res.json(trending);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch trending' });
    }
};
```

## Security Features
- ✅ Helmet for security headers
- ✅ CORS with origin restrictions
- ✅ Rate limiting (100 req/15min general, 5 req/15min for auth)
- ✅ JWT authentication with expiry
- ✅ Password hashing with bcrypt
- ✅ Input validation with express-validator
- ✅ File upload restrictions (type, size)
- ✅ SQL injection protection via MongoDB
- ✅ XSS protection via input sanitization

## Environment Variables
Required in `.env.local`:
```
PORT=3001
JWT_SECRET=your-secret-key
GEMINI_API_KEY=your-gemini-api-key
MONGODB_URI=mongodb://localhost:27017
DB_NAME=campus
CORS_ORIGIN=http://localhost:3000
```

## Running the Server

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Using Scripts
```bash
# From root directory
.\start-backend.ps1
# Or
.\start-all.ps1  # Starts both backend and frontend
```

## Testing
After refactoring, test all endpoints:
1. ✅ Login works
2. ✅ Announcements CRUD operations
3. ✅ User management
4. ✅ Document upload/download
5. ✅ AI chatbot responds
6. ✅ Web scraping functions

## Backup
Original monolithic server backed up as `server-old.mjs`

## Future Enhancements
- [ ] Add unit tests for controllers
- [ ] Add integration tests for routes
- [ ] Add API documentation (Swagger/OpenAPI)
- [ ] Add request logging
- [ ] Add performance monitoring
- [ ] Add database connection pooling optimization
- [ ] Add caching layer (Redis)
- [ ] Add WebSocket support for real-time updates

## Migration Notes
- All functionality preserved from original server
- No breaking changes to API contracts
- Frontend requires no changes
- Database schema unchanged
- Environment variables unchanged

## Troubleshooting

### Server won't start
- Check MongoDB is running
- Verify .env.local exists with all required variables
- Check port 3001 is not in use

### Authentication fails
- Verify JWT_SECRET matches between restarts
- Check token expiry settings
- Ensure database has user records

### Routes not found
- Check route imports in server.mjs
- Verify route path matches API calls
- Check middleware order (auth before controllers)
