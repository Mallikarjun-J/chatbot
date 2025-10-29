import { db } from '../database.mjs';
import { analyzeTimetable, validateTimetableStructure } from '../services/timetableAnalysisService.mjs';
import path from 'path';
import fs from 'fs';

/**
 * Upload and analyze class timetable (Admin only)
 * POST /api/timetables/class
 */
export const uploadClassTimetable = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { branch, section } = req.body;
        const filePath = req.file.path;
        const fileType = path.extname(req.file.originalname).substring(1).toLowerCase();

        console.log(`📤 Admin uploading class timetable for ${branch}-${section}`);

        // Analyze timetable using AI
        const analysis = await analyzeTimetable(filePath, fileType, 'class');

        if (!analysis.success) {
            // Delete uploaded file if analysis fails
            fs.unlinkSync(filePath);
            return res.status(500).json({ error: 'Failed to analyze timetable: ' + analysis.error });
        }

        const timetableData = analysis.data;

        // Override with provided branch/section if specified
        if (branch) timetableData.branch = branch;
        if (section) timetableData.section = section;

        // Validate structure
        if (!validateTimetableStructure(timetableData, 'class')) {
            fs.unlinkSync(filePath);
            return res.status(400).json({ error: 'Invalid timetable structure extracted' });
        }

        // Check if timetable already exists for this branch/section
        const existing = await db.getClassTimetable(timetableData.branch, timetableData.section);

        let result;
        if (existing) {
            // Update existing
            result = await db.updateClassTimetable(existing.id, {
                ...timetableData,
                filePath: `/uploads/${req.file.filename}`
            });
            console.log(`✅ Updated class timetable for ${timetableData.branch}-${timetableData.section}`);
        } else {
            // Create new
            result = await db.createClassTimetable({
                ...timetableData,
                filePath: `/uploads/${req.file.filename}`,
                uploadedBy: req.user?.id || 'admin'
            });
            console.log(`✅ Created class timetable for ${timetableData.branch}-${timetableData.section}`);
        }

        res.json({
            success: true,
            message: 'Timetable uploaded and analyzed successfully',
            timetable: result,
            analysis: {
                model: analysis.model,
                extractedData: timetableData
            }
        });

    } catch (error) {
        console.error('Class timetable upload error:', error);
        if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to upload class timetable' });
    }
};

/**
 * Upload and analyze teacher timetable
 * POST /api/timetables/teacher
 */
export const uploadTeacherTimetable = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const teacherId = req.user?.id;
        if (!teacherId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const filePath = req.file.path;
        const fileType = path.extname(req.file.originalname).substring(1).toLowerCase();

        console.log(`📤 Teacher ${teacherId} uploading personal timetable`);

        // Analyze timetable using AI
        const analysis = await analyzeTimetable(filePath, fileType, 'teacher');

        if (!analysis.success) {
            fs.unlinkSync(filePath);
            return res.status(500).json({ error: 'Failed to analyze timetable: ' + analysis.error });
        }

        const timetableData = analysis.data;

        // Validate structure
        if (!validateTimetableStructure(timetableData, 'teacher')) {
            fs.unlinkSync(filePath);
            return res.status(400).json({ error: 'Invalid timetable structure extracted' });
        }

        // Check if timetable already exists for this teacher
        const existing = await db.getTeacherTimetable(teacherId);

        let result;
        if (existing) {
            // Update existing
            result = await db.updateTeacherTimetable(teacherId, {
                ...timetableData,
                filePath: `/uploads/${req.file.filename}`
            });
            console.log(`✅ Updated teacher timetable for ${teacherId}`);
        } else {
            // Create new
            result = await db.createTeacherTimetable({
                ...timetableData,
                teacherId,
                filePath: `/uploads/${req.file.filename}`
            });
            console.log(`✅ Created teacher timetable for ${teacherId}`);
        }

        res.json({
            success: true,
            message: 'Timetable uploaded and analyzed successfully',
            timetable: result,
            analysis: {
                model: analysis.model,
                extractedData: timetableData
            }
        });

    } catch (error) {
        console.error('Teacher timetable upload error:', error);
        if (req.file?.path && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to upload teacher timetable' });
    }
};

/**
 * Get class timetable by branch and section
 * GET /api/timetables/class/:branch/:section
 */
export const getClassTimetable = async (req, res) => {
    try {
        const { branch, section } = req.params;
        const timetable = await db.getClassTimetable(branch, section);

        if (!timetable) {
            return res.status(404).json({ error: 'Timetable not found for this class' });
        }

        res.json(timetable);
    } catch (error) {
        console.error('Get class timetable error:', error);
        res.status(500).json({ error: 'Failed to fetch class timetable' });
    }
};

/**
 * Get teacher's personal timetable
 * GET /api/timetables/teacher/:teacherId
 */
export const getTeacherTimetable = async (req, res) => {
    try {
        const { teacherId } = req.params;
        
        // Teachers can only view their own timetable unless admin
        if (req.user?.role !== 'Admin' && req.user?.id !== teacherId) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        const timetable = await db.getTeacherTimetable(teacherId);

        if (!timetable) {
            return res.status(404).json({ error: 'Timetable not found for this teacher' });
        }

        res.json(timetable);
    } catch (error) {
        console.error('Get teacher timetable error:', error);
        res.status(500).json({ error: 'Failed to fetch teacher timetable' });
    }
};

/**
 * Get all class timetables (Admin only)
 * GET /api/timetables/class
 */
export const getAllClassTimetables = async (req, res) => {
    try {
        const timetables = await db.getAllClassTimetables();
        res.json(timetables);
    } catch (error) {
        console.error('Get all class timetables error:', error);
        res.status(500).json({ error: 'Failed to fetch class timetables' });
    }
};

/**
 * Delete class timetable (Admin only)
 * DELETE /api/timetables/class/:id
 */
export const deleteClassTimetable = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await db.deleteClassTimetable(id);

        if (!deleted) {
            return res.status(404).json({ error: 'Timetable not found' });
        }

        res.json({ success: true, message: 'Timetable deleted successfully' });
    } catch (error) {
        console.error('Delete class timetable error:', error);
        res.status(500).json({ error: 'Failed to delete timetable' });
    }
};
