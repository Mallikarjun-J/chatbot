import express from 'express';
import { body } from 'express-validator';
import { authenticateToken, validate } from '../middleware/auth.mjs';
import {
    getAllAnnouncements,
    createAnnouncement,
    updateAnnouncement,
    deleteAnnouncement
} from '../controllers/announcementsController.mjs';

const router = express.Router();

/**
 * GET /api/announcements
 * Get all announcements
 */
router.get('/announcements', getAllAnnouncements);

/**
 * POST /api/announcements
 * Create new announcement (admin/teacher only)
 */
router.post('/announcements',
    authenticateToken,
    body('title').notEmpty().withMessage('Title is required'),
    body('content').notEmpty().withMessage('Content is required'),
    validate,
    createAnnouncement
);

/**
 * PUT /api/announcements/:id
 * Update announcement (admin/teacher only)
 */
router.put('/announcements/:id',
    authenticateToken,
    body('title').optional().notEmpty().withMessage('Title cannot be empty'),
    body('content').optional().notEmpty().withMessage('Content cannot be empty'),
    validate,
    updateAnnouncement
);

/**
 * DELETE /api/announcements/:id
 * Delete announcement (admin only)
 */
router.delete('/announcements/:id', authenticateToken, deleteAnnouncement);

export default router;
