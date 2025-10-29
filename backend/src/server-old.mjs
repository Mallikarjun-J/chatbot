import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { connectDB } from './mongo-client.mjs';
import { db, seedDatabase, createIndexes, initializeCollections } from './database.mjs';
import { ObjectId } from 'mongodb';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';
import cron from 'node-cron';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-this';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- Security Middleware ---
app.use(helmet({
    contentSecurityPolicy: false, // Allow inline scripts for development
    crossOriginEmbedderPolicy: false
}));

// CORS Configuration - Restrict to specific origin
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // Limit login attempts
    message: 'Too many login attempts, please try again later.'
});

app.use('/api/', limiter);

// --- Basic Setup ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- File Upload Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}
app.use('/uploads', express.static(UPLOADS_DIR));

// Secure file upload configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        // Sanitize filename to prevent path traversal
        const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(sanitizedOriginalName));
    }
});

const fileFilter = (req, file, cb) => {
    // Allow only specific file types
    const allowedMimeTypes = [
        'image/jpeg', 'image/png', 'image/jpg',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only images, PDFs, and Office documents are allowed.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB default
    }
});

// --- Real JWT Authentication Middleware ---
/**
 * @param {Express.Request & { userId?: string }} req
 * @param {Express.Response} res
 * @param {import('express').NextFunction} next
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }
        
        // Verify JWT token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (!decoded.userId || !ObjectId.isValid(decoded.userId)) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        
        // Check if database is connected
        if (!db || !db.users) {
            return res.status(503).json({ error: 'Database not ready. Please try again.' });
        }
        
        // Load full user object from database
        const user = await db.users.findOne({ _id: new ObjectId(decoded.userId) });
        
        if (!user) {
            return res.status(403).json({ error: 'User not found' });
        }
        
        req.userId = decoded.userId;
        req.user = user; // Attach full user object for endpoints that need it
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({ error: 'Invalid token format' });
        }
        console.error('Token authentication error:', error);
        return res.status(403).json({ error: 'Invalid token' });
    }
};

// Validation middleware helper
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
};

// --- API Routes ---

// Auth - Login with proper JWT and password hashing
/**
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
app.post('/api/auth/login', 
    authLimiter,
    [
        body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
        body('password').notEmpty().withMessage('Password is required')
    ],
    validate,
    async (req, res) => {
        try {
            const { email, password } = req.body;
            
            const user = await db.findUserByEmailWithPassword(email);

            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            
            // Compare hashed password
            const isPasswordValid = await bcrypt.compare(password, user.password);
            
            if (!isPasswordValid) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
            
            // Generate real JWT token
            const token = jwt.sign(
                { userId: user.id, email: user.email, role: user.role },
                JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
            );
            
            const { password: _password, ...userWithoutPassword } = user;
            res.json({ token, user: userWithoutPassword });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

// Announcements
/**
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
app.get('/api/announcements', async (req, res) => {
    try {
        res.json(await db.getAnnouncements());
    } catch (error) {
        console.error('Get announcements error:', error);
        res.status(500).json({ error: 'Failed to fetch announcements' });
    }
});

/**
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
app.post('/api/announcements', 
    authenticateToken,
    [
        body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
        body('content').trim().isLength({ min: 10, max: 5000 }).withMessage('Content must be 10-5000 characters'),
        body('eventDate').optional().isISO8601().withMessage('Invalid event date'),
        body('eventTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format'),
        body('location').optional().trim().isLength({ max: 200 }).withMessage('Location too long')
    ],
    validate,
    async (req, res) => {
        try {
            const announcement = await db.createAnnouncement(req.body);
            res.status(201).json(announcement);
        } catch (error) {
            console.error('Create announcement error:', error);
            res.status(500).json({ error: 'Failed to create announcement' });
        }
    }
);

/**
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
app.put('/api/announcements/:id', 
    authenticateToken,
    [
        body('title').trim().isLength({ min: 3, max: 200 }).withMessage('Title must be 3-200 characters'),
        body('content').trim().isLength({ min: 10, max: 5000 }).withMessage('Content must be 10-5000 characters'),
        body('eventDate').optional().isISO8601().withMessage('Invalid event date'),
        body('eventTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format'),
        body('location').optional().trim().isLength({ max: 200 }).withMessage('Location too long')
    ],
    validate,
    async (req, res) => {
        try {
            const announcement = await db.updateAnnouncement(req.params.id, req.body);
            if (announcement) {
                res.json(announcement);
            } else {
                res.status(404).json({ error: 'Announcement not found' });
            }
        } catch (error) {
            console.error('Update announcement error:', error);
            res.status(500).json({ error: 'Failed to update announcement' });
        }
    }
);

/**
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
app.delete('/api/announcements/:id', authenticateToken, async (req, res) => {
    try {
        const success = await db.deleteAnnouncement(req.params.id);
        if (success) {
            res.sendStatus(204);
        } else {
            res.status(404).json({ error: "Announcement not found" });
        }
    } catch (error) {
        console.error('Delete announcement error:', error);
        res.status(500).json({ error: 'Failed to delete announcement' });
    }
});

// Users
/**
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        res.json(await db.getUsers());
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
app.post('/api/users', 
    authenticateToken,
    [
        body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
        body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
        body('role').isIn(['Admin', 'Teacher', 'Student']).withMessage('Invalid role')
    ],
    validate,
    async (req, res) => {
        try {
            if (await db.emailExists(req.body.email)) {
                return res.status(409).json({ error: 'Email already in use' });
            }
            const newUser = await db.createUser(req.body);
            res.status(201).json(newUser);
        } catch (error) {
            console.error('Create user error:', error);
            res.status(500).json({ error: 'Failed to create user' });
        }
    }
);

/**
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
app.put('/api/users/:id/role', 
    authenticateToken,
    [
        body('role').isIn(['Admin', 'Teacher', 'Student']).withMessage('Invalid role')
    ],
    validate,
    async (req, res) => {
        try {
            const updatedUser = await db.updateUser(req.params.id, { role: req.body.role });
            if (updatedUser) {
                res.json(updatedUser);
            } else {
                res.status(404).json({ error: "User not found" });
            }
        } catch (error) {
            console.error('Update user role error:', error);
            res.status(500).json({ error: 'Failed to update user role' });
        }
    }
);
/**
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    const success = await db.deleteUser(req.params.id);
    if (success) {
        res.sendStatus(204);
    } else {
        res.status(404).json({ error: "User not found." });
    }
});
/**
 * @param {Express.Request & { userId?: string, file?: import('multer').File }} req
 * @param {Express.Response} res
 */
app.post('/api/users/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send({ error: 'No file uploaded.' });
    }
    const avatarUrl = `/uploads/${req.file.filename}`;
    const updatedUser = await db.updateUser(req.userId, { avatarUrl });
    res.json(updatedUser);
});

// Documents & Timetable
/**
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
app.get('/api/documents', authenticateToken, async (req, res) => {
    res.json(await db.getDocuments());
});
/**
 * @param {Express.Request & { file?: import('multer').File }} req
 * @param {Express.Response} res
 */
app.post('/api/upload/timetable', authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const { filename, originalname, mimetype, size } = req.file;
    await db.createDocument({ filename, originalname, mimetype, size, type: 'timetable' });
    res.status(201).json({ message: 'Timetable uploaded successfully.' });
});
/**
 * @param {Express.Request & { file?: import('multer').File }} req
 * @param {Express.Response} res
 */
app.post('/api/upload/document', authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const { filename, originalname, mimetype, size } = req.file;
    await db.createDocument({ filename, originalname, mimetype, size, type: 'general' });
    res.status(201).json({ message: 'Document uploaded successfully.' });
});
/**
 * @param {Express.Request} req
 * @param {Express.Response} res
 */
app.delete('/api/documents/:id', authenticateToken, async (req, res) => {
    try {
        const deletedDoc = await db.deleteDocument(req.params.id);
        if (!deletedDoc) {
            return res.status(404).json({ error: 'Document not found' });
        }
        res.sendStatus(204);
    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
});

// Advanced Knowledge Base Builder for AI
async function buildKnowledgeBase(prompt) {
    // Initialize with safe defaults that won't cause .map() errors
    const knowledge = {
        announcements: [],
        documents: [],
        users: [],
        events: [],
        placements: {
            recentPlacements: [],
            totalPlacementAnnouncements: 0
        },
        liveData: null
    };
    
    try {
        // Ensure database collections exist
        if (!db || !db.announcements || !db.documents || !db.users) {
            console.log('⚠️ Database collections not initialized yet - returning safe defaults');
            return knowledge;
        }
        
        // Get recent announcements (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        try {
            knowledge.announcements = await db.announcements
                .find({ date: { $gte: thirtyDaysAgo.toISOString().split('T')[0] } })
                .sort({ date: -1 })
                .limit(20)
                .toArray() || [];
        } catch (err) {
            console.log('⚠️ Failed to fetch announcements:', err.message);
            knowledge.announcements = [];
        }
        
        // Get document metadata
        try {
            knowledge.documents = await db.documents
                .find()
                .sort({ uploadDate: -1 })
                .limit(10)
                .toArray() || [];
        } catch (err) {
            console.log('⚠️ Failed to fetch documents:', err.message);
            knowledge.documents = [];
        }
        
        // Get user statistics
        try {
            const userStats = await db.users.aggregate([
                { $group: { _id: '$role', count: { $sum: 1 } } }
            ]).toArray() || [];
            knowledge.users = userStats;
        } catch (err) {
            console.log('⚠️ Failed to fetch user stats:', err.message);
            knowledge.users = [];
        }
        
        // Check if prompt is asking about placements, events, or live data
        const promptLower = prompt.toLowerCase();
        
        // Fetch deep scraped data from database (always available from previous deep scrapes)
        try {
            // Get scraped placements data
            if (promptLower.includes('placement') || promptLower.includes('recruit') || promptLower.includes('job') || promptLower.includes('company') || promptLower.includes('package') || promptLower.includes('lpa')) {
                const scrapedPlacements = await getDB().collection('scraped_placements')
                    .find()
                    .sort({ scrapedAt: -1 })
                    .limit(15)
                    .toArray();
                knowledge.scrapedPlacements = scrapedPlacements || [];
            }
            
            // Get scraped announcements data
            if (promptLower.includes('announcement') || promptLower.includes('notice') || promptLower.includes('circular') || promptLower.includes('latest') || promptLower.includes('recent')) {
                const scrapedAnnouncements = await getDB().collection('scraped_announcements')
                    .find()
                    .sort({ scrapedAt: -1 })
                    .limit(15)
                    .toArray();
                knowledge.scrapedAnnouncements = scrapedAnnouncements || [];
            }
            
            // Get scraped events data
            if (promptLower.includes('event') || promptLower.includes('workshop') || promptLower.includes('seminar') || promptLower.includes('fest') || promptLower.includes('upcoming')) {
                const scrapedEvents = await getDB().collection('scraped_events')
                    .find()
                    .sort({ scrapedAt: -1 })
                    .limit(15)
                    .toArray();
                knowledge.scrapedEvents = scrapedEvents || [];
            }
            
            // Get scraped academics data
            if (promptLower.includes('exam') || promptLower.includes('result') || promptLower.includes('syllabus') || promptLower.includes('course') || promptLower.includes('admission') || promptLower.includes('academic')) {
                const scrapedAcademics = await getDB().collection('scraped_academics')
                    .find()
                    .sort({ scrapedAt: -1 })
                    .limit(15)
                    .toArray();
                knowledge.scrapedAcademics = scrapedAcademics || [];
            }
            
            // Get general scraped data if no specific category matches
            if (!knowledge.scrapedPlacements && !knowledge.scrapedAnnouncements && !knowledge.scrapedEvents && !knowledge.scrapedAcademics) {
                const scrapedGeneral = await getDB().collection('scraped_general')
                    .find()
                    .sort({ scrapedAt: -1 })
                    .limit(10)
                    .toArray();
                knowledge.scrapedGeneral = scrapedGeneral || [];
            }
        } catch (err) {
            console.log('⚠️ Failed to fetch scraped data:', err.message);
        }
        
        // If asking about placements or live data, scrape college website
        if (promptLower.includes('placement') || 
            promptLower.includes('recruit') || 
            promptLower.includes('job') ||
            promptLower.includes('event') ||
            promptLower.includes('upcoming') ||
            promptLower.includes('latest') ||
            promptLower.includes('recent')) {
            
            // Get scraping config to fetch live data
            try {
                const config = db.scrapeConfig ? await db.scrapeConfig.findOne({ type: 'announcements' }) : null;
                
                if (config && config.url) {
                    try {
                        // Scrape live data from college website
                        const liveAnnouncements = await scrapeAnnouncements(config.url, config.selectors);
                        knowledge.liveData = {
                            source: config.url,
                            announcements: liveAnnouncements.slice(0, 10),
                            scrapedAt: new Date().toISOString()
                        };
                    } catch (scrapeError) {
                        console.log('Live scraping failed, using cached data:', scrapeError.message);
                    }
                }
            } catch (err) {
                console.log('⚠️ Scrape config not available:', err.message);
            }
        }
        
        // Extract placement statistics from announcements (with null safety)
        if (knowledge.announcements && Array.isArray(knowledge.announcements) && knowledge.announcements.length > 0) {
            const placementKeywords = ['placement', 'recruited', 'hired', 'offer', 'package', 'lpa', 'ctc'];
            const placementAnnouncements = knowledge.announcements.filter(ann => 
                placementKeywords.some(keyword => 
                    ann.title?.toLowerCase().includes(keyword) || 
                    ann.content?.toLowerCase().includes(keyword)
                )
            );
            
            knowledge.placements = {
                recentPlacements: placementAnnouncements.slice(0, 5),
                totalPlacementAnnouncements: placementAnnouncements.length
            };
        } else {
            knowledge.placements = {
                recentPlacements: [],
                totalPlacementAnnouncements: 0
            };
        }
        
        // Extract events from announcements (with null safety)
        if (knowledge.announcements && Array.isArray(knowledge.announcements) && knowledge.announcements.length > 0) {
            const eventKeywords = ['event', 'workshop', 'seminar', 'conference', 'competition', 'fest', 'hackathon'];
            const eventAnnouncements = knowledge.announcements.filter(ann =>
                eventKeywords.some(keyword =>
                    ann.title?.toLowerCase().includes(keyword) ||
                    ann.content?.toLowerCase().includes(keyword)
                )
            );
            
            knowledge.events = eventAnnouncements.slice(0, 10);
        } else {
            knowledge.events = [];
        }
        
    } catch (error) {
        console.error('Knowledge base building error:', error);
    }
    
    return knowledge;
}

// Advanced Gemini AI Chat with Knowledge Base
app.post('/api/ai/chat',
    [
        body('prompt').trim().isLength({ min: 1, max: 2000 }).withMessage('Prompt must be 1-2000 characters'),
        body('history').optional().isArray().withMessage('History must be an array')
    ],
    validate,
    async (req, res) => {
        try {
            if (!GEMINI_API_KEY) {
                return res.status(500).json({ error: 'AI service not configured' });
            }

            const { prompt, history, context } = req.body;
            
            // Build comprehensive knowledge base
            console.log('🧠 Building knowledge base for:', prompt.substring(0, 50) + '...');
            const knowledge = await buildKnowledgeBase(prompt);
            
            const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
            
            // Build advanced system instruction with full context
            let systemInstruction = `You are CampusAura AI, an intelligent assistant for college campus management.

🎯 YOUR MAIN JOB:
- **ANALYZE the scraped data thoroughly** and extract ALL relevant information
- **NEVER** just say "Info not available" - SEARCH through all the content provided
- Read through the full content in SCRAPED sections below
- Extract specific numbers, names, dates, percentages from the content
- Provide detailed, informative answers based on what you find

📋 RESPONSE FORMATTING:

**For Placement Queries:**
✅ Extract company names, packages (LPA/CTC), placement rates, student numbers
✅ Look for: "recruited", "placed", "package", "salary", "CTC", "LPA", company names
✅ Format with emojis and bullet points
✅ Show specific numbers and percentages found in content

**For Announcements:**
✅ List each announcement clearly with date
✅ Summarize the key point of each announcement
✅ Include relevant deadlines or dates
✅ Group by category (admissions, exams, events, etc.)

**For Events:**
✅ List event name, date, time, venue
✅ Brief description of what it's about
✅ Who should attend

**General Rules:**
1. **THOROUGHLY READ** all scraped content provided in knowledge base
2. **EXTRACT** specific details: numbers, dates, names, amounts
3. **FORMAT** nicely with emojis and structure
4. **BE SPECIFIC** - mention actual companies, actual numbers, actual dates
5. **CITE SOURCES** - include URLs from the scraped data
6. **If no data exists**, suggest where to find it or what to scrape next

❌ **NEVER SAY:**
- "Info not available" (without checking scraped content first)
- "You can find..." (without giving actual info from scraped data)
- Generic responses without specific details

✅ **ALWAYS DO:**
- Read the full scraped content provided below
- Extract ALL specific details (companies, amounts, dates, etc.)
- Provide concrete information found in the data
- Format beautifully with emojis and bullets

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 KNOWLEDGE BASE (Updated: ${new Date().toISOString()})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${knowledge.scrapedPlacements && knowledge.scrapedPlacements.length > 0 ? `
� ═══ SCRAPED PLACEMENT DATA (${knowledge.scrapedPlacements.length} items) ═══
⚠️ READ THIS SECTION CAREFULLY - CONTAINS ACTUAL PLACEMENT DETAILS
${knowledge.scrapedPlacements.map((item, i) => 
    `
【${i + 1}】 ${item.title}
📄 Full Content: ${item.content || 'No content'}
🔗 Source URL: ${item.url}
📅 Scraped: ${new Date(item.scrapedAt).toLocaleDateString()}
`
).join('\n')}

� TASK: Analyze the above content and extract:
   - Company names (TCS, Infosys, Amazon, etc.)
   - Package amounts (look for "LPA", "CTC", "salary", numbers like "15 LPA")
   - Placement statistics (percentage, number of students)
   - Any other relevant placement information
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

${knowledge.scrapedAnnouncements && knowledge.scrapedAnnouncements.length > 0 ? `
� ═══ SCRAPED ANNOUNCEMENTS (${knowledge.scrapedAnnouncements.length} items) ═══
⚠️ READ THIS SECTION CAREFULLY - CONTAINS ACTUAL ANNOUNCEMENTS
${knowledge.scrapedAnnouncements.map((item, i) => 
    `
【${i + 1}】 ${item.title}
📄 Full Content: ${item.content || 'No content'}
🔗 Source URL: ${item.url}
📅 Scraped: ${new Date(item.scrapedAt).toLocaleDateString()}
`
).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

${knowledge.scrapedEvents && knowledge.scrapedEvents.length > 0 ? `
🎉 ═══ SCRAPED EVENTS (${knowledge.scrapedEvents.length} items) ═══
⚠️ READ THIS SECTION CAREFULLY - CONTAINS ACTUAL EVENTS
${knowledge.scrapedEvents.map((item, i) => 
    `
【${i + 1}】 ${item.title}
📄 Full Content: ${item.content || 'No content'}
🔗 Source URL: ${item.url}
📅 Scraped: ${new Date(item.scrapedAt).toLocaleDateString()}
`
).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

${knowledge.scrapedAcademics && knowledge.scrapedAcademics.length > 0 ? `
📚 ═══ SCRAPED ACADEMIC INFO (${knowledge.scrapedAcademics.length} items) ═══
⚠️ READ THIS SECTION CAREFULLY - CONTAINS ACTUAL ACADEMIC INFORMATION
${knowledge.scrapedAcademics.map((item, i) => 
    `
【${i + 1}】 ${item.title}
📄 Full Content: ${item.content || 'No content'}
🔗 Source URL: ${item.url}
📅 Scraped: ${new Date(item.scrapedAt).toLocaleDateString()}
`
).join('\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

${knowledge.scrapedGeneral && knowledge.scrapedGeneral.length > 0 ? `
📄 ═══ OTHER SCRAPED INFORMATION (${knowledge.scrapedGeneral.length} items) ═══
${knowledge.scrapedGeneral.map((item, i) => 
    `【${i + 1}】 ${item.title}\n   ${item.content?.substring(0, 300) || 'No content'}...\n   URL: ${item.url}`
).join('\n\n')}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

� Database Announcements (${knowledge.announcements?.length || 0}):
${knowledge.announcements && knowledge.announcements.length > 0 ? knowledge.announcements.slice(0, 10).map((ann, i) => 
    `${i + 1}. [${ann.date}] ${ann.title}\n   ${ann.content?.substring(0, 200) || ''}...`
).join('\n') : 'None'}

📊 Placement Stats from Database (${knowledge.placements?.totalPlacementAnnouncements || 0}):
${knowledge.placements?.recentPlacements && knowledge.placements.recentPlacements.length > 0 ? 
    knowledge.placements.recentPlacements.slice(0, 5).map((ann, i) => `${i + 1}. ${ann.title}`).join('\n') : 'None'}

📅 Events from Database (${knowledge.events?.length || 0}):
${knowledge.events && knowledge.events.length > 0 ? 
    knowledge.events.slice(0, 5).map((evt, i) => `${i + 1}. ${evt.title}`).join('\n') : 'None'}
`;

            if (context) {
                systemInstruction += `\n\n👤 CURRENT USER CONTEXT:
- Role: ${context.role}
- Name: ${context.name}
- Permissions: ${JSON.stringify(context.permissions)}
${context.data ? `- Additional Data: ${JSON.stringify(context.data)}` : ''}

Tailor your response based on the user's role. For example:
- Students: Focus on events, placements, schedules, resources
- Teachers: Highlight class schedules, student info, resources
- Admins: Provide system statistics, management insights
`;
            }

            // Build chat history for the API
            const contents = [];
            if (Array.isArray(history) && history.length > 0) {
                history.forEach(msg => {
                    contents.push({
                        role: msg.role === 'user' ? 'user' : 'model',
                        parts: [{ text: msg.content }]
                    });
                });
            }
            
            // Add current user prompt with context
            contents.push({
                role: 'user',
                parts: [{ text: `${prompt}\n\n(Please use the knowledge base provided in your system instructions to answer accurately.)` }]
            });

            // Try with retry logic and fallback models
            const models = ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'];
            let lastError = null;
            
            for (const modelName of models) {
                try {
                    console.log(`🤖 Using model: ${modelName}`);
                    const result = await genAI.models.generateContent({
                        model: modelName,
                        contents: contents,
                        config: {
                            systemInstruction: systemInstruction,
                            temperature: 0.7,
                            maxOutputTokens: 2000, // Increased for detailed responses
                        }
                    });
                    
                    const responseText = result.text || result.response?.text?.() || 'Sorry, I could not generate a response.';
                    
                    // Build sources from knowledge base
                    const sources = [];
                    
                    if (knowledge.announcements.length > 0) {
                        sources.push({
                            type: 'announcements',
                            count: knowledge.announcements.length,
                            latest: knowledge.announcements[0]?.title
                        });
                    }
                    
                    if (knowledge.liveData) {
                        sources.push({
                            type: 'live_scraping',
                            url: knowledge.liveData.source,
                            scrapedAt: knowledge.liveData.scrapedAt,
                            count: knowledge.liveData.announcements.length
                        });
                    }
                    
                    if (knowledge.placements.recentPlacements.length > 0) {
                        sources.push({
                            type: 'placements',
                            count: knowledge.placements.totalPlacementAnnouncements
                        });
                    }
                    
                    if (knowledge.events.length > 0) {
                        sources.push({
                            type: 'events',
                            count: knowledge.events.length
                        });
                    }
                    
                    console.log(`✅ AI response generated with ${sources.length} sources`);
                    
                    return res.json({
                        content: responseText,
                        sources: sources,
                        model: modelName,
                        knowledgeBase: {
                            announcementsUsed: knowledge.announcements.length,
                            liveDataFetched: !!knowledge.liveData,
                            placementsFound: knowledge.placements.totalPlacementAnnouncements,
                            eventsFound: knowledge.events.length
                        }
                    });
                } catch (err) {
                    lastError = err;
                    // If 503 (overloaded) or 429 (quota), try next model
                    if ((err.status === 503 || err.status === 429) && models.indexOf(modelName) < models.length - 1) {
                        console.log(`Model ${modelName} ${err.status === 429 ? 'quota exceeded' : 'overloaded'}, trying next model...`);
                        continue;
                    }
                    // If it's a different error or last model, throw
                    throw err;
                }
            }
            
            throw lastError;
        } catch (error) {
            console.error('AI chat error:', error);
            
            // Provide helpful error message based on error type
            if (error.status === 503) {
                return res.status(503).json({ 
                    error: 'AI service is temporarily overloaded. Please try again in a moment.' 
                });
            }
            
            if (error.status === 429) {
                return res.status(429).json({ 
                    error: 'AI service quota exceeded. The free tier has limits. Please try again later or upgrade your API plan.',
                    helpUrl: 'https://ai.google.dev/gemini-api/docs/rate-limits'
                });
            }
            
            // FALLBACK: Provide direct data response when AI fails
            console.log('⚠️ AI failed, providing direct data response');
            
            let fallbackResponse = "I'm currently experiencing issues with my AI service, but here's what I found in the database:\n\n";
            
            // Add scraped placements if available
            if (knowledge.scrapedPlacements && knowledge.scrapedPlacements.length > 0) {
                fallbackResponse += "📊 **Placement Information:**\n";
                knowledge.scrapedPlacements.slice(0, 5).forEach((item, i) => {
                    fallbackResponse += `${i + 1}. ${item.title}\n`;
                    if (item.content) fallbackResponse += `   ${item.content.substring(0, 150)}...\n`;
                    fallbackResponse += `   [Read more](${item.url})\n\n`;
                });
            }
            
            // Add scraped announcements if available
            if (knowledge.scrapedAnnouncements && knowledge.scrapedAnnouncements.length > 0) {
                fallbackResponse += "📢 **Recent Announcements:**\n";
                knowledge.scrapedAnnouncements.slice(0, 5).forEach((item, i) => {
                    fallbackResponse += `${i + 1}. ${item.title}\n`;
                    if (item.content) fallbackResponse += `   ${item.content.substring(0, 150)}...\n`;
                    fallbackResponse += `   [Read more](${item.url})\n\n`;
                });
            }
            
            // Add scraped events if available
            if (knowledge.scrapedEvents && knowledge.scrapedEvents.length > 0) {
                fallbackResponse += "🎉 **Events:**\n";
                knowledge.scrapedEvents.slice(0, 5).forEach((item, i) => {
                    fallbackResponse += `${i + 1}. ${item.title}\n`;
                    if (item.content) fallbackResponse += `   ${item.content.substring(0, 150)}...\n`;
                    fallbackResponse += `   [Read more](${item.url})\n\n`;
                });
            }
            
            // Add scraped academics if available
            if (knowledge.scrapedAcademics && knowledge.scrapedAcademics.length > 0) {
                fallbackResponse += "📚 **Academic Information:**\n";
                knowledge.scrapedAcademics.slice(0, 5).forEach((item, i) => {
                    fallbackResponse += `${i + 1}. ${item.title}\n`;
                    if (item.content) fallbackResponse += `   ${item.content.substring(0, 150)}...\n`;
                    fallbackResponse += `   [Read more](${item.url})\n\n`;
                });
            }
            
            // Add regular announcements if no scraped data
            if (!knowledge.scrapedPlacements && !knowledge.scrapedAnnouncements && !knowledge.scrapedEvents && !knowledge.scrapedAcademics) {
                if (knowledge.announcements && knowledge.announcements.length > 0) {
                    fallbackResponse += "📢 **Recent Announcements:**\n";
                    knowledge.announcements.slice(0, 5).forEach((ann, i) => {
                        fallbackResponse += `${i + 1}. ${ann.title} (${ann.date})\n`;
                        if (ann.content) fallbackResponse += `   ${ann.content.substring(0, 150)}...\n\n`;
                    });
                }
            }
            
            if (fallbackResponse.trim() === "I'm currently experiencing issues with my AI service, but here's what I found in the database:\n\n") {
                fallbackResponse = "I'm currently experiencing issues with my AI service and no data is available at the moment. Please try again later or contact support.\n\n**To fix this:**\n1. Get a new Gemini API key from https://aistudio.google.com/app/apikey\n2. Update your .env file with the new key\n3. Restart the server";
            }
            
            return res.json({
                content: fallbackResponse,
                sources: [{type: 'fallback', message: 'AI unavailable, showing raw data'}],
                model: 'fallback',
                warning: 'AI service unavailable. Showing direct database results.'
            });
        }
    }
);

// --- Web Scraping Endpoints ---

// Helper function to scrape announcements from a webpage
async function scrapeAnnouncements(url, selectors = {}) {
    try {
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        const announcements = [];
        
        // Default selectors - can be customized per college website
        const titleSelector = selectors.title || 'h2, h3, .title, .announcement-title';
        const contentSelector = selectors.content || 'p, .content, .announcement-content, .description';
        const dateSelector = selectors.date || '.date, .announcement-date, time';
        const containerSelector = selectors.container || '.announcement, .news-item, article, .post';
        
        // If container selector exists, iterate through containers
        if ($(containerSelector).length > 0) {
            $(containerSelector).each((i, elem) => {
                const $elem = $(elem);
                const title = $elem.find(titleSelector).first().text().trim();
                const content = $elem.find(contentSelector).first().text().trim();
                const dateText = $elem.find(dateSelector).first().text().trim();
                
                if (title) {
                    announcements.push({
                        title,
                        content: content || title,
                        date: dateText || new Date().toISOString().split('T')[0],
                        source: url,
                        scrapedAt: new Date()
                    });
                }
            });
        } else {
            // Fallback: scrape all titles and their next content
            $(titleSelector).each((i, elem) => {
                const $elem = $(elem);
                const title = $elem.text().trim();
                const content = $elem.next(contentSelector).text().trim();
                
                if (title && title.length > 10) { // Filter out very short titles
                    announcements.push({
                        title,
                        content: content || title,
                        date: new Date().toISOString().split('T')[0],
                        source: url,
                        scrapedAt: new Date()
                    });
                }
            });
        }
        
        return announcements.slice(0, 20); // Limit to 20 announcements
    } catch (error) {
        console.error('Scraping error:', error.message);
        throw new Error(`Failed to scrape ${url}: ${error.message}`);
    }
}

// POST endpoint to scrape a college website
app.post('/api/scrape/announcements',
    authenticateToken,
    [
        body('url').isURL().withMessage('Valid URL is required'),
        body('selectors').optional().isObject()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        // Only admins can scrape websites
        if (req.user.role.toLowerCase() !== 'admin') {
            return res.status(403).json({ error: 'Only admins can scrape websites' });
        }
        
        try {
            const { url, selectors, autoSave } = req.body;
            const scrapedAnnouncements = await scrapeAnnouncements(url, selectors);
            
            // If autoSave is true, save to database
            if (autoSave && scrapedAnnouncements.length > 0) {
                const announcementsToSave = scrapedAnnouncements.map(ann => ({
                    ...ann,
                    createdBy: req.user.name,
                    createdAt: new Date(),
                    isScraped: true
                }));
                
                const result = await db.announcements.insertMany(announcementsToSave);
                
                res.json({
                    success: true,
                    message: `Scraped and saved ${result.insertedCount} announcements`,
                    count: result.insertedCount,
                    announcements: scrapedAnnouncements
                });
            } else {
                res.json({
                    success: true,
                    message: `Found ${scrapedAnnouncements.length} announcements`,
                    count: scrapedAnnouncements.length,
                    announcements: scrapedAnnouncements
                });
            }
        } catch (error) {
            console.error('Scrape endpoint error:', error);
            res.status(500).json({ error: error.message });
        }
    }
);

// GET endpoint to retrieve scraping configuration
app.get('/api/scrape/config', authenticateToken, async (req, res) => {
    try {
        const config = await db.scrapeConfig?.findOne({ type: 'announcements' });
        res.json(config || {
            url: '',
            selectors: {},
            schedule: '0 */6 * * *', // Every 6 hours
            enabled: false
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch config' });
    }
});

// POST endpoint to save scraping configuration
app.post('/api/scrape/config',
    authenticateToken,
    [
        body('url').optional().isURL(),
        body('selectors').optional().isObject(),
        body('schedule').optional().isString(),
        body('enabled').optional().isBoolean()
    ],
    async (req, res) => {
        if (req.user.role.toLowerCase() !== 'admin') {
            return res.status(403).json({ error: 'Only admins can configure scraping' });
        }
        
        try {
            const config = {
                type: 'announcements',
                ...req.body,
                updatedAt: new Date(),
                updatedBy: req.user.name
            };
            
            await db.scrapeConfig?.updateOne(
                { type: 'announcements' },
                { $set: config },
                { upsert: true }
            );
            
            res.json({ success: true, config });
        } catch (error) {
            res.status(500).json({ error: 'Failed to save config' });
        }
    }
);

// **NEW** Advanced Deep Scraping Endpoint
app.post('/api/scrape/deep',
    authenticateToken,
    [
        body('url').isURL().withMessage('Valid base URL is required'),
        body('maxPages').optional().isInt({ min: 1, max: 100 }).withMessage('Max pages must be between 1-100'),
        body('maxDepth').optional().isInt({ min: 1, max: 5 }).withMessage('Max depth must be between 1-5')
    ],
    validate,
    async (req, res) => {
        if (req.user.role.toLowerCase() !== 'admin') {
            return res.status(403).json({ error: 'Only admins can perform deep scraping' });
        }
        
        try {
            const { url, maxPages = 50, maxDepth = 3 } = req.body;
            
            // Import advanced scraper
            const { deepScrape } = await import('./advanced-scraper.mjs');
            
            console.log(`🕷️  Starting deep scrape of ${url}...`);
            
            // Perform deep scraping
            const results = await deepScrape(url, {
                maxPages: parseInt(maxPages),
                maxDepth: parseInt(maxDepth),
                delay: 1000
            });
            
            // Save results to separate collections
            let savedCounts = {
                placements: 0,
                announcements: 0,
                events: 0,
                academics: 0
            };
            
            // Save placements
            if (results.placements.length > 0) {
                const placementDocs = results.placements.map(item => ({
                    ...item,
                    createdBy: req.user.name,
                    createdAt: new Date(),
                    isScraped: true,
                    category: 'placement'
                }));
                
                for (const doc of placementDocs) {
                    await db.announcements.updateOne(
                        { title: doc.title, isScraped: true },
                        { $setOnInsert: doc },
                        { upsert: true }
                    );
                }
                savedCounts.placements = placementDocs.length;
            }
            
            // Save announcements
            if (results.announcements.length > 0) {
                const announcementDocs = results.announcements.map(item => ({
                    title: item.title,
                    content: item.fullContent || item.content,
                    date: item.date,
                    priority: item.priority > 0.5 ? 'High' : 'Medium',
                    createdBy: req.user.name,
                    createdAt: new Date(),
                    isScraped: true,
                    source: item.url,
                    category: 'announcement'
                }));
                
                for (const doc of announcementDocs) {
                    await db.announcements.updateOne(
                        { title: doc.title, isScraped: true },
                        { $setOnInsert: doc },
                        { upsert: true }
                    );
                }
                savedCounts.announcements = announcementDocs.length;
            }
            
            // Save events
            if (results.events.length > 0) {
                const eventDocs = results.events.map(item => ({
                    title: item.title,
                    content: item.fullContent || item.content,
                    date: item.date,
                    priority: 'High',
                    createdBy: req.user.name,
                    createdAt: new Date(),
                    isScraped: true,
                    source: item.url,
                    category: 'event'
                }));
                
                for (const doc of eventDocs) {
                    await db.announcements.updateOne(
                        { title: doc.title, isScraped: true },
                        { $setOnInsert: doc },
                        { upsert: true }
                    );
                }
                savedCounts.events = eventDocs.length;
            }
            
            // Save academics
            if (results.academics.length > 0) {
                const academicDocs = results.academics.map(item => ({
                    title: item.title,
                    content: item.fullContent || item.content,
                    date: item.date,
                    priority: 'Medium',
                    createdBy: req.user.name,
                    createdAt: new Date(),
                    isScraped: true,
                    source: item.url,
                    category: 'academic'
                }));
                
                for (const doc of academicDocs) {
                    await db.announcements.updateOne(
                        { title: doc.title, isScraped: true },
                        { $setOnInsert: doc },
                        { upsert: true }
                    );
                }
                savedCounts.academics = academicDocs.length;
            }
            
            res.json({
                success: true,
                message: `Deep scraping completed successfully`,
                statistics: {
                    pagesScraped: results.placements.length + results.announcements.length + 
                                 results.events.length + results.academics.length + results.general.length,
                    saved: savedCounts,
                    found: {
                        placements: results.placements.length,
                        announcements: results.announcements.length,
                        events: results.events.length,
                        academics: results.academics.length,
                        general: results.general.length
                    }
                },
                preview: {
                    placements: results.placements.slice(0, 3),
                    announcements: results.announcements.slice(0, 3),
                    events: results.events.slice(0, 3)
                }
            });
            
        } catch (error) {
            console.error('Deep scraping error:', error);
            res.status(500).json({ 
                error: 'Deep scraping failed', 
                details: error.message 
            });
        }
    }
);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 5MB' });
        }
        return res.status(400).json({ error: 'File upload error' });
    }
    
    res.status(err.status || 500).json({ 
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message 
    });
});

// --- Start Server ---
const startServer = async () => {
    try {
        await connectDB();
        initializeCollections(); // Initialize db.users, db.announcements, etc.
        await seedDatabase();
        await createIndexes();
        
        // Set up automated scraping schedule
        const setupAutomatedScraping = async () => {
            try {
                const config = await db.scrapeConfig.findOne({ type: 'announcements' });
                
                if (config && config.enabled && config.url) {
                    console.log(`📡 Setting up automated scraping: ${config.schedule || '0 */6 * * *'}`);
                    
                    // Schedule the scraping task
                    cron.schedule(config.schedule || '0 */6 * * *', async () => {
                        try {
                            console.log('🔄 Running scheduled announcement scraping...');
                            const announcements = await scrapeAnnouncements(config.url, config.selectors);
                            
                            if (announcements.length > 0) {
                                const toSave = announcements.map(ann => ({
                                    ...ann,
                                    createdBy: 'Automated Scraper',
                                    createdAt: new Date(),
                                    isScraped: true
                                }));
                                
                                // Only insert new announcements (check by title)
                                for (const ann of toSave) {
                                    await db.announcements.updateOne(
                                        { title: ann.title, isScraped: true },
                                        { $setOnInsert: ann },
                                        { upsert: true }
                                    );
                                }
                                
                                console.log(`✅ Scraped ${announcements.length} announcements`);
                            }
                        } catch (error) {
                            console.error('❌ Scheduled scraping failed:', error.message);
                        }
                    });
                }
            } catch (error) {
                console.log('ℹ️ No automated scraping configured');
            }
        };
        
        await setupAutomatedScraping();
        
        const server = app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
            console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔒 Security: JWT, Rate Limiting, Helmet enabled`);
        });

        // Graceful shutdown
        const gracefulShutdown = (signal) => {
            console.log(`\n${signal} received. Closing server gracefully...`);
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();