import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/auth.mjs';
import { login } from '../controllers/authController.mjs';

const router = express.Router();

/**
 * POST /api/login
 * User login endpoint
 */
router.post('/login',
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required'),
    validate,
    login
);

export default router;
