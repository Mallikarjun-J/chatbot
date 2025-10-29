import express from 'express';
import { body } from 'express-validator';
import { authenticateToken, validate } from '../middleware/auth.mjs';
import {
    getAllUsers,
    createUser,
    updateUser,
    deleteUser
} from '../controllers/usersController.mjs';

const router = express.Router();

/**
 * GET /api/users
 * Get all users (admin only)
 */
router.get('/users', authenticateToken, getAllUsers);

/**
 * POST /api/users
 * Create new user (admin only)
 */
router.post('/users',
    authenticateToken,
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').isIn(['student', 'teacher', 'admin']).withMessage('Invalid role'),
    validate,
    createUser
);

/**
 * PUT /api/users/:id
 * Update user (admin only)
 */
router.put('/users/:id',
    authenticateToken,
    body('name').optional().notEmpty().withMessage('Name cannot be empty'),
    body('email').optional().isEmail().withMessage('Please provide a valid email'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('role').optional().isIn(['student', 'teacher', 'admin']).withMessage('Invalid role'),
    validate,
    updateUser
);

/**
 * DELETE /api/users/:id
 * Delete user (admin only)
 */
router.delete('/users/:id', authenticateToken, deleteUser);

export default router;
