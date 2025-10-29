import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticateToken } from '../middleware/auth.mjs';
import {
    getAllDocuments,
    uploadDocument,
    downloadDocument,
    deleteDocument
} from '../controllers/documentsController.mjs';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../../uploads/'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|doc|docx|ppt|pptx|xls|xlsx|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only document files are allowed (PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT)'));
        }
    }
});

/**
 * GET /api/documents
 * Get all documents
 */
router.get('/documents', authenticateToken, getAllDocuments);

/**
 * POST /api/documents
 * Upload new document (admin/teacher only)
 */
router.post('/documents',
    authenticateToken,
    upload.single('file'),
    uploadDocument
);

/**
 * GET /api/documents/:id/download
 * Download document
 */
router.get('/documents/:id/download', authenticateToken, downloadDocument);

/**
 * DELETE /api/documents/:id
 * Delete document (admin only)
 */
router.delete('/documents/:id', authenticateToken, deleteDocument);

export default router;
