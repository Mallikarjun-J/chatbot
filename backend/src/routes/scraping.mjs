import express from 'express';
import { body } from 'express-validator';
import { authenticateToken, validate } from '../middleware/auth.mjs';
import {
    scrapeAnnouncements,
    deepScrapeAnnouncements,
    getScrapeConfig,
    saveScrapeConfig
} from '../controllers/scrapingController.mjs';

const router = express.Router();

/**
 * POST /api/scrape/announcements
 * Basic web scraping (admin only)
 */
router.post('/scrape/announcements',
    authenticateToken,
    body('url').isURL().withMessage('Please provide a valid URL'),
    validate,
    scrapeAnnouncements
);

/**
 * GET /api/scrape/config
 * Get automated scraping configuration (admin only)
 */
router.get('/scrape/config',
    authenticateToken,
    getScrapeConfig
);

/**
 * POST /api/scrape/config
 * Save automated scraping configuration (admin only)
 */
router.post('/scrape/config',
    authenticateToken,
    body('url').optional().isURL().withMessage('Please provide a valid URL'),
    validate,
    saveScrapeConfig
);

/**
 * POST /api/scrape-announcements (Legacy - kept for backward compatibility)
 * Basic web scraping (admin only)
 */
router.post('/scrape-announcements',
    authenticateToken,
    body('url').isURL().withMessage('Please provide a valid URL'),
    body('category').notEmpty().withMessage('Category is required'),
    validate,
    scrapeAnnouncements
);

/**
 * POST /api/deep-scrape
 * Advanced deep scraping with AI extraction (admin only)
 */
router.post('/deep-scrape',
    authenticateToken,
    body('url').isURL().withMessage('Please provide a valid URL'),
    body('category').notEmpty().withMessage('Category is required'),
    body('maxDepth').optional().isInt({ min: 1, max: 3 }).withMessage('Max depth must be between 1 and 3'),
    body('maxPages').optional().isInt({ min: 1, max: 50 }).withMessage('Max pages must be between 1 and 50'),
    validate,
    deepScrapeAnnouncements
);

export default router;
