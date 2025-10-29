import bcrypt from 'bcrypt';
import { db } from '../database.mjs';

/**
 * Get all users
 * GET /api/users
 */
export const getAllUsers = async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user || !req.user.role.toLowerCase().includes('admin')) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        res.json(await db.getUsers());
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
};

/**
 * Create new user
 * POST /api/users
 */
export const createUser = async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user || !req.user.role.toLowerCase().includes('admin')) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Hash password before creating user
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const userData = {
            ...req.body,
            password: hashedPassword
        };

        const user = await db.createUser(userData);
        res.status(201).json(user);
    } catch (error) {
        console.error('Create user error:', error);
        if (error.message.includes('already exists')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to create user' });
    }
};

/**
 * Update user
 * PUT /api/users/:id
 */
export const updateUser = async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user || !req.user.role.toLowerCase().includes('admin')) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Hash password if it's being updated
        let userData = { ...req.body };
        if (userData.password) {
            userData.password = await bcrypt.hash(userData.password, 10);
        }

        const user = await db.updateUser(req.params.id, userData);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
};

/**
 * Delete user
 * DELETE /api/users/:id
 */
export const deleteUser = async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user || !req.user.role.toLowerCase().includes('admin')) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const success = await db.deleteUser(req.params.id);
        if (!success) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
};
