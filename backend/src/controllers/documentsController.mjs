import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { db } from '../database.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Get all documents
 * GET /api/documents
 */
export const getAllDocuments = async (req, res) => {
    try {
        res.json(await db.getDocuments());
    } catch (error) {
        console.error('Get documents error:', error);
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
};

/**
 * Upload new document
 * POST /api/documents
 */
export const uploadDocument = async (req, res) => {
    try {
        // Check if user has permission (admin or teacher)
        if (!req.user || (!req.user.role.toLowerCase().includes('admin') && !req.user.role.toLowerCase().includes('teacher'))) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const documentData = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            path: req.file.path,
            size: req.file.size,
            mimeType: req.file.mimetype,
            uploadedBy: req.user.email
        };

        const document = await db.createDocument(documentData);
        res.status(201).json(document);
    } catch (error) {
        console.error('Upload document error:', error);
        // Delete uploaded file if database operation fails
        if (req.file && req.file.path) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to upload document' });
    }
};

/**
 * Download document
 * GET /api/documents/:id/download
 */
export const downloadDocument = async (req, res) => {
    try {
        const document = await db.getDocumentById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        const filePath = path.join(__dirname, '../../../', document.path);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found on server' });
        }

        res.download(filePath, document.originalName);
    } catch (error) {
        console.error('Download document error:', error);
        res.status(500).json({ error: 'Failed to download document' });
    }
};

/**
 * Delete document
 * DELETE /api/documents/:id
 */
export const deleteDocument = async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user || !req.user.role.toLowerCase().includes('admin')) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const document = await db.getDocumentById(req.params.id);
        if (!document) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Delete file from filesystem
        const filePath = path.join(__dirname, '../../../', document.path);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Delete from database
        const success = await db.deleteDocument(req.params.id);
        if (!success) {
            return res.status(404).json({ error: 'Document not found' });
        }

        res.json({ message: 'Document deleted successfully' });
    } catch (error) {
        console.error('Delete document error:', error);
        res.status(500).json({ error: 'Failed to delete document' });
    }
};
