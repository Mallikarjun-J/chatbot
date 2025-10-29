import { db } from '../database.mjs';

/**
 * Get all announcements
 * GET /api/announcements
 */
export const getAllAnnouncements = async (req, res) => {
    try {
        res.json(await db.getAnnouncements());
    } catch (error) {
        console.error('Get announcements error:', error);
        res.status(500).json({ error: 'Failed to fetch announcements' });
    }
};

/**
 * Create new announcement
 * POST /api/announcements
 */
export const createAnnouncement = async (req, res) => {
    try {
        // Check if user has permission (admin or teacher)
        if (!req.user || (!req.user.role.toLowerCase().includes('admin') && !req.user.role.toLowerCase().includes('teacher'))) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const announcement = await db.createAnnouncement(req.body);
        res.status(201).json(announcement);
    } catch (error) {
        console.error('Create announcement error:', error);
        res.status(500).json({ error: 'Failed to create announcement' });
    }
};

/**
 * Update announcement
 * PUT /api/announcements/:id
 */
export const updateAnnouncement = async (req, res) => {
    try {
        // Check if user has permission (admin or teacher)
        if (!req.user || (!req.user.role.toLowerCase().includes('admin') && !req.user.role.toLowerCase().includes('teacher'))) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const announcement = await db.updateAnnouncement(req.params.id, req.body);
        if (!announcement) {
            return res.status(404).json({ error: 'Announcement not found' });
        }
        res.json(announcement);
    } catch (error) {
        console.error('Update announcement error:', error);
        res.status(500).json({ error: 'Failed to update announcement' });
    }
};

/**
 * Delete announcement
 * DELETE /api/announcements/:id
 */
export const deleteAnnouncement = async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user || !req.user.role.toLowerCase().includes('admin')) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const success = await db.deleteAnnouncement(req.params.id);
        if (!success) {
            return res.status(404).json({ error: 'Announcement not found' });
        }
        res.json({ message: 'Announcement deleted successfully' });
    } catch (error) {
        console.error('Delete announcement error:', error);
        res.status(500).json({ error: 'Failed to delete announcement' });
    }
};
