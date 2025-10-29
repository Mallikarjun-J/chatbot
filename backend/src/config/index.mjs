import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

export const config = {
    port: process.env.PORT || 3001,
    jwtSecret: process.env.JWT_SECRET || 'fallback-secret-change-this',
    geminiApiKey: process.env.GEMINI_API_KEY,
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    dbName: process.env.DB_NAME || 'campus',
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
};
