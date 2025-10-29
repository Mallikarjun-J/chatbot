import { getDB } from './mongo-client.mjs';
import { ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// --- Setup for file deletion ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.join(__dirname, 'uploads');

const SALT_ROUNDS = 10;

// --- Helper to get collections ---
const getCollections = () => {
    const database = getDB();
    return {
        users: database.collection('users'),
        announcements: database.collection('announcements'),
        documents: database.collection('documents'),
        classTimetables: database.collection('classTimetables'),
        teacherTimetables: database.collection('teacherTimetables'),
    };
};

// --- Initialize collections after DB connection ---
export const initializeCollections = () => {
    const database = getDB();
    db.users = database.collection('users');
    db.announcements = database.collection('announcements');
    db.documents = database.collection('documents');
    db.scrapeConfig = database.collection('scrapeConfig');
    db.classTimetables = database.collection('classTimetables');
    db.teacherTimetables = database.collection('teacherTimetables');
    console.log('✅ Database collections initialized');
};

// --- Data Seeding for first-time setup ---
export const seedDatabase = async () => {
    const { users, announcements } = getCollections();
    
    const userCount = await users.countDocuments();
    if (userCount === 0) {
        console.log('🌱 No users found. Seeding default users with hashed passwords...');
        
        // Hash the default password
        const hashedPassword = await bcrypt.hash('password123', SALT_ROUNDS);
        
        const defaultUsers = [
            { _id: new ObjectId('665f3a9a9332d65a2575a001'), name: 'Admin User', email: 'admin@campus.com', password: hashedPassword, role: 'Admin', avatarUrl: null },
            { _id: new ObjectId('665f3a9a9332d65a2575a002'), name: 'Teacher User', email: 'teacher@campus.com', password: hashedPassword, role: 'Teacher', avatarUrl: null },
            { _id: new ObjectId('665f3a9a9332d65a2575a003'), name: 'Student User', email: 'student@campus.com', password: hashedPassword, role: 'Student', avatarUrl: null },
            { _id: new ObjectId('665f3a9a9332d65a2575a004'), name: 'Jane Doe', email: 'jane.doe@campus.com', password: hashedPassword, role: 'Student', avatarUrl: null },
            { _id: new ObjectId('665f3a9a9332d65a2575a005'), name: 'John Smith', email: 'john.smith@campus.com', password: hashedPassword, role: 'Teacher', avatarUrl: null },
        ];
        await users.insertMany(defaultUsers);
    }

    const announcementCount = await announcements.countDocuments();
    if (announcementCount === 0) {
        console.log('🌱 No announcements found. Seeding default announcements...');
        const defaultAnnouncements = [
            { 
                title: 'Welcome Week Schedule', 
                content: 'Welcome Week kicks off on Monday! Check the student portal for a full schedule of events.', 
                date: new Date('2024-08-20T10:00:00Z'),
                eventDate: "2024-08-26",
                eventTime: "09:00",
                location: "Main Quad"
            },
            { title: 'Library Hours Extended', content: 'For final exams, the main library will be open 24/7 starting next week.', date: new Date('2024-08-18T15:30:00Z') },
            { title: 'Tech Fest "Innovate 2024"', content: 'The annual tech fest is just around the corner. Sign up to volunteer or showcase your project!', date: new Date('2024-08-15T11:00:00Z') },
        ];
        await announcements.insertMany(defaultAnnouncements);
    }
};


// --- Helper function to map _id to id for client-side consistency ---
const mapDocument = (doc) => {
    if (!doc) return null;
    const { _id, ...rest } = doc;
    return { id: _id.toHexString(), ...rest };
};

// --- Database Interface ---
// Export collections object that will be populated after connection
export const db = {
    users: null,
    announcements: null,
    documents: null,
    scrapeConfig: null,
    
    // --- User Management ---
    getUsers: async () => {
        const { users } = getCollections();
        const userDocs = await users.find({}, { projection: { password: 0 } }).toArray();
        return userDocs.map(mapDocument);
    },
    findUserByEmailWithPassword: async (email) => {
        const { users } = getCollections();
        const user = await users.findOne({ email });
        return user ? mapDocument(user) : null;
    },
    emailExists: async (email) => {
        const { users } = getCollections();
        const count = await users.countDocuments({ email });
        return count > 0;
    },
    createUser: async ({ name, email, role }) => {
        const { users } = getCollections();
        
        // Hash default password for new users
        const hashedPassword = await bcrypt.hash('password123', SALT_ROUNDS);
        
        const newUserDoc = {
            name,
            email,
            role,
            password: hashedPassword,
            avatarUrl: null,
        };
        const result = await users.insertOne(newUserDoc);
        const createdUser = await users.findOne({ _id: result.insertedId }, { projection: { password: 0 } });
        return mapDocument(createdUser);
    },
    updateUser: async (id, updates) => {
        const { users } = getCollections();
        const userObjectId = new ObjectId(id);
        
        // If updating avatar, delete the old one from file system
        const userToUpdate = await users.findOne({ _id: userObjectId });
        if (updates.avatarUrl && userToUpdate?.avatarUrl) {
            const oldAvatarFullPath = path.join(__dirname, userToUpdate.avatarUrl);
            if (fs.existsSync(oldAvatarFullPath)) {
                fs.unlink(oldAvatarFullPath, (err) => {
                    if (err) console.error("Error deleting old avatar:", err);
                });
            }
        }
        
        const result = await users.findOneAndUpdate(
            { _id: userObjectId },
            { $set: updates },
            { returnDocument: 'after', projection: { password: 0 } }
        );
        return mapDocument(result.value);
    },
    deleteUser: async (id) => {
        const { users } = getCollections();
        const result = await users.deleteOne({ _id: new ObjectId(id) });
        return result.deletedCount > 0;
    },

    // --- Announcement Management ---
    getAnnouncements: async () => {
        const { announcements } = getCollections();
        const announcementDocs = await announcements.find().sort({ date: -1 }).toArray();
        return announcementDocs.map(mapDocument);
    },
    createAnnouncement: async ({ title, content, eventDate, eventTime, location }) => {
        const { announcements } = getCollections();
        // FIX: Add JSDoc type annotation to allow adding optional properties.
        /** @type {Record<string, any>} */
        const newAnnouncementDoc = {
            title,
            content,
            date: new Date()
        };
        if (eventDate) newAnnouncementDoc.eventDate = eventDate;
        if (eventTime) newAnnouncementDoc.eventTime = eventTime;
        if (location) newAnnouncementDoc.location = location;

        const result = await announcements.insertOne(newAnnouncementDoc);
        const createdAnnouncement = await announcements.findOne({_id: result.insertedId});
        return mapDocument(createdAnnouncement);
    },
    updateAnnouncement: async (id, { title, content, eventDate, eventTime, location }) => {
        const { announcements } = getCollections();
        // FIX: Add JSDoc type annotation to allow adding optional properties to $set and $unset.
        /** @type {{ $set: Record<string, any>, $unset: Record<string, any> }} */
        const updateDoc = {
            $set: { title, content },
            $unset: {}
        };
    
        if (eventDate) updateDoc.$set.eventDate = eventDate; else updateDoc.$unset.eventDate = "";
        if (eventTime) updateDoc.$set.eventTime = eventTime; else updateDoc.$unset.eventTime = "";
        if (location) updateDoc.$set.location = location; else updateDoc.$unset.location = "";
        
        if (Object.keys(updateDoc.$unset).length === 0) {
            delete updateDoc.$unset;
        }

        const result = await announcements.findOneAndUpdate(
            { _id: new ObjectId(id) },
            updateDoc,
            { returnDocument: 'after' }
        );
        return mapDocument(result.value);
    },
    deleteAnnouncement: async (id) => {
        const { announcements } = getCollections();
        const result = await announcements.deleteOne({ _id: new ObjectId(id) });
        return result.deletedCount > 0;
    },

    // --- Document Management ---
    getDocuments: async () => {
        const { documents } = getCollections();
        const documentDocs = await documents.find().sort({ uploadDate: -1 }).toArray();
        return documentDocs.map(mapDocument);
    },
    createDocument: async ({ filename, originalname, mimetype, size, type }) => {
        const { documents } = getCollections();
        const newDocument = {
            filename,
            originalname,
            mimetype,
            size,
            uploadDate: new Date(),
            type,
        };
        const result = await documents.insertOne(newDocument);
        const createdDoc = await documents.findOne({ _id: result.insertedId });
        return mapDocument(createdDoc);
    },
    deleteDocument: async (id) => {
        const { documents } = getCollections();
        const docToDelete = await documents.findOne({ _id: new ObjectId(id) });
        if (!docToDelete) return null;
        
        const result = await documents.deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount > 0) {
            // Delete the actual file from storage
            const filePath = path.join(UPLOADS_DIR, docToDelete.filename);
            fs.unlink(filePath, (err) => {
                if (err) console.error(`Error deleting file ${filePath}:`, err);
            });
            return mapDocument(docToDelete);
        }
        return null;
    },

    // --- Scraping Configuration Management ---
    getScrapeConfig: async () => {
        const database = getDB();
        const scrapeConfig = database.collection('scrapeConfig');
        const config = await scrapeConfig.findOne({});
        return config ? mapDocument(config) : null;
    },
    saveScrapeConfig: async (config) => {
        const database = getDB();
        const scrapeConfig = database.collection('scrapeConfig');
        const result = await scrapeConfig.findOneAndUpdate(
            {},
            { $set: config },
            { upsert: true, returnDocument: 'after' }
        );
        return mapDocument(result.value);
    },

    // --- Class Timetable Management ---
    createClassTimetable: async ({ branch, section, semester, days, filePath, uploadedBy }) => {
        const { classTimetables } = getCollections();
        const timetableDoc = {
            branch,
            section,
            semester,
            days,
            filePath,
            uploadedBy,
            uploadDate: new Date()
        };
        const result = await classTimetables.insertOne(timetableDoc);
        const created = await classTimetables.findOne({ _id: result.insertedId });
        return mapDocument(created);
    },

    getClassTimetable: async (branch, section) => {
        const { classTimetables } = getCollections();
        const timetable = await classTimetables.findOne({ branch, section });
        return timetable ? mapDocument(timetable) : null;
    },

    getAllClassTimetables: async () => {
        const { classTimetables } = getCollections();
        const timetables = await classTimetables.find().toArray();
        return timetables.map(mapDocument);
    },

    updateClassTimetable: async (id, { branch, section, semester, days, filePath }) => {
        const { classTimetables } = getCollections();
        const updateDoc = { branch, section, semester, days };
        if (filePath) updateDoc.filePath = filePath;
        updateDoc.lastUpdated = new Date();
        
        const result = await classTimetables.findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: updateDoc },
            { returnDocument: 'after' }
        );
        return result ? mapDocument(result) : null;
    },

    deleteClassTimetable: async (id) => {
        const { classTimetables } = getCollections();
        const result = await classTimetables.deleteOne({ _id: new ObjectId(id) });
        return result.deletedCount > 0;
    },

    // --- Teacher Timetable Management ---
    createTeacherTimetable: async ({ teacherId, teacherName, department, employeeId, days, filePath }) => {
        const { teacherTimetables } = getCollections();
        const timetableDoc = {
            teacherId: new ObjectId(teacherId),
            teacherName,
            department,
            employeeId,
            days,
            filePath,
            uploadDate: new Date()
        };
        const result = await teacherTimetables.insertOne(timetableDoc);
        const created = await teacherTimetables.findOne({ _id: result.insertedId });
        return mapDocument(created);
    },

    getTeacherTimetable: async (teacherId) => {
        const { teacherTimetables } = getCollections();
        const timetable = await teacherTimetables.findOne({ teacherId: new ObjectId(teacherId) });
        return timetable ? mapDocument(timetable) : null;
    },

    getAllTeacherTimetables: async () => {
        const { teacherTimetables } = getCollections();
        const timetables = await teacherTimetables.find().toArray();
        return timetables.map(mapDocument);
    },

    updateTeacherTimetable: async (teacherId, { teacherName, department, employeeId, days, filePath }) => {
        const { teacherTimetables } = getCollections();
        const updateDoc = { teacherName, department, employeeId, days };
        if (filePath) updateDoc.filePath = filePath;
        updateDoc.lastUpdated = new Date();
        
        const result = await teacherTimetables.findOneAndUpdate(
            { teacherId: new ObjectId(teacherId) },
            { $set: updateDoc },
            { returnDocument: 'after' }
        );
        return result ? mapDocument(result) : null;
    },

    deleteTeacherTimetable: async (teacherId) => {
        const { teacherTimetables } = getCollections();
        const result = await teacherTimetables.deleteOne({ teacherId: new ObjectId(teacherId) });
        return result.deletedCount > 0;
    }
};

// --- Create Database Indexes for Performance ---
export const createIndexes = async () => {
    try {
        const { users, announcements, documents, classTimetables, teacherTimetables } = getCollections();
        
        // User indexes
        await users.createIndex({ email: 1 }, { unique: true });
        await users.createIndex({ role: 1 });
        
        // Announcement indexes
        await announcements.createIndex({ date: -1 });
        
        // Document indexes
        await documents.createIndex({ uploadDate: -1 });
        await documents.createIndex({ type: 1 });
        
        // Timetable indexes
        await classTimetables.createIndex({ branch: 1, section: 1 }, { unique: true });
        await teacherTimetables.createIndex({ teacherId: 1 }, { unique: true });
        
        console.log('✅ Database indexes created successfully');
    } catch (error) {
        console.error('Error creating indexes:', error);
    }
};