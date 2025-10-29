import express from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/auth.mjs';
import { chatWithAI } from '../controllers/aiController.mjs';

const router = express.Router();

/**
 * POST /api/chat
 * AI chatbot endpoint
 */
router.post('/chat',
    body('message').notEmpty().withMessage('Message is required'),
    body('category').optional().isString(),
    validate,
    chatWithAI
);

export default router;
