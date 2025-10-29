import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.mjs';
import { db } from '../database.mjs';

/**
 * User login handler
 * POST /api/login
 */
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const user = await db.findUserByEmailWithPassword(email);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Compare hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email, role: user.role },
            config.jwtSecret,
            { expiresIn: config.jwtExpiresIn }
        );
        
        const { password: _password, ...userWithoutPassword } = user;
        res.json({ token, user: userWithoutPassword });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
