import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cron from 'node-cron';

// Import configuration
import { config } from './config/index.mjs';

// Import database
import { connectDB } from './mongo-client.mjs';
import { db, seedDatabase, createIndexes, initializeCollections } from './database.mjs';

// Import routes
import authRoutes from './routes/auth.mjs';
import announcementsRoutes from './routes/announcements.mjs';
import usersRoutes from './routes/users.mjs';
import documentsRoutes from './routes/documents.mjs';
import aiRoutes from './routes/ai.mjs';
import scrapingRoutes from './routes/scraping.mjs';
import timetableRoutes from './routes/timetables.mjs';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Security Middleware ---
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// CORS Configuration
app.use(cors({
    origin: config.corsOrigin,
    credentials: true
}));

// Rate Limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: 'Too many login attempts, please try again later.'
});

app.use('/api/', limiter);

// --- Body Parsing ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- Static File Serving ---
const UPLOADS_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api', announcementsRoutes);
app.use('/api', usersRoutes);
app.use('/api', documentsRoutes);
app.use('/api', aiRoutes);
app.use('/api', scrapingRoutes);
app.use('/api', timetableRoutes);

// --- Health Check ---
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: err.message });
    }
    
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
});

// --- 404 Handler ---
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// --- Database Connection & Server Startup ---
async function startServer() {
    try {
        console.log('Connecting to MongoDB...');
        await connectDB();
        console.log('MongoDB connected successfully');

        console.log('Initializing collections...');
        await initializeCollections();
        console.log('Collections initialized');

        console.log('Creating indexes...');
        await createIndexes();
        console.log('Indexes created');

        console.log('Seeding database...');
        await seedDatabase();
        console.log('Database seeded');

        app.listen(config.port, () => {
            console.log(`
╔════════════════════════════════════════════╗
║   Campus Aura Backend Server               ║
║   Running on: http://localhost:${config.port}     ║
║   Environment: ${config.nodeEnv}           ║
║   MongoDB: Connected                       ║
╚════════════════════════════════════════════╝
            `);
        });

        // Schedule periodic tasks (optional - can be enabled later)
        // cron.schedule('0 */6 * * *', async () => {
        //     console.log('Running scheduled tasks...');
        //     // Add scheduled scraping or cleanup tasks here
        // });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nShutting down gracefully...');
    process.exit(0);
});

// Start the server
startServer();

export default app;
