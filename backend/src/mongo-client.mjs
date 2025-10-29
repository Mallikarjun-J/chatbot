import { MongoClient } from 'mongodb';
import process from 'process';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// --- Connection Setup ---
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'campus';

const client = new MongoClient(MONGODB_URI);
let db;

/**
 * Connects to the MongoDB server and initializes the database instance.
 * @throws {Error} If the connection fails.
 */
export const connectDB = async () => {
    try {
        await client.connect();
        db = client.db(DB_NAME);
        console.log(`✅ Successfully connected to MongoDB database: ${DB_NAME}`);
    } catch (error) {
        console.error('❌ Could not connect to MongoDB', error);
        process.exit(1); // Exit the process with an error
    }
};

/**
 * Returns the database instance. Throws an error if not connected.
 * @returns {Db} The MongoDB database instance.
 */
export const getDB = () => {
    if (!db) {
        throw new Error('Database not initialized! Make sure connectDB() is called first.');
    }
    return db;
};