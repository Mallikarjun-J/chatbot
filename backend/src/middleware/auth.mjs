import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { config } from '../config/index.mjs';
import { db } from '../database.mjs';

/**
 * JWT Authentication Middleware
 */
export const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }
        
        // Verify JWT token
        const decoded = jwt.verify(token, config.jwtSecret);
        
        if (!decoded.userId || !ObjectId.isValid(decoded.userId)) {
            return res.status(403).json({ error: 'Invalid token' });
        }
        
        // Check if database is connected
        if (!db || !db.users) {
            return res.status(503).json({ error: 'Database not ready. Please try again.' });
        }
        
        // Load full user object from database
        const user = await db.users.findOne({ _id: new ObjectId(decoded.userId) });
        
        if (!user) {
            return res.status(403).json({ error: 'User not found' });
        }
        
        req.userId = decoded.userId;
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({ error: 'Invalid token format' });
        }
        console.error('Token authentication error:', error);
        return res.status(403).json({ error: 'Invalid token' });
    }
};

/**
 * Validation middleware helper
 */
import { validationResult } from 'express-validator';

export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: errors.array()[0].msg });
    }
    next();
};

/**
 * Role-based authorization middleware
 * @param {string[]} roles - Array of allowed roles
 */
export const requireRole = (roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};

// Alias for compatibility
export const authenticate = authenticateToken;
