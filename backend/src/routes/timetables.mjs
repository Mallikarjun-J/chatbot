import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticate, requireRole } from '../middleware/auth.mjs';
import {
    uploadClassTimetable,
    uploadTeacherTimetable,
    getClassTimetable,
    getTeacherTimetable,
    getAllClassTimetables,
    deleteClassTimetable
} from '../controllers/timetableController.mjs';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'timetable-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, PNG, JPG allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * POST /api/timetables/class
 * Upload class timetable (Admin only)
 */
router.post('/timetables/class',
    authenticate,
    requireRole(['Admin']),
    upload.single('timetable'),
    uploadClassTimetable
);

/**
 * POST /api/timetables/teacher
 * Upload teacher timetable (Teacher only)
 */
router.post('/timetables/teacher',
    authenticate,
    requireRole(['Teacher']),
    upload.single('timetable'),
    uploadTeacherTimetable
);

/**
 * GET /api/timetables/class/:branch/:section
 * Get class timetable by branch and section
 */
router.get('/timetables/class/:branch/:section',
    authenticate,
    getClassTimetable
);

/**
 * GET /api/timetables/teacher/:teacherId
 * Get teacher's timetable
 */
router.get('/timetables/teacher/:teacherId',
    authenticate,
    getTeacherTimetable
);

/**
 * GET /api/timetables/class
 * Get all class timetables (Admin only)
 */
router.get('/timetables/class',
    authenticate,
    requireRole(['Admin']),
    getAllClassTimetables
);

/**
 * DELETE /api/timetables/class/:id
 * Delete class timetable (Admin only)
 */
router.delete('/timetables/class/:id',
    authenticate,
    requireRole(['Admin']),
    deleteClassTimetable
);

export default router;
