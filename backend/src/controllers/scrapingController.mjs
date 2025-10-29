import { scrapeWebsite } from '../services/scrapingService.mjs';
import { deepScrape } from '../advanced-scraper.mjs';
import { db } from '../database.mjs';

/**
 * Basic web scraping handler
 * POST /api/scrape-announcements
 */
export const scrapeAnnouncements = async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user || !req.user.role.toLowerCase().includes('admin')) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { url, category, autoSave, selectors } = req.body;
        
        const announcements = await scrapeWebsite(url, category, selectors);
        
        if (announcements.length === 0) {
            return res.json({ 
                message: 'No announcements found',
                count: 0,
                announcements: []
            });
        }

        // Auto-save to database if requested
        let savedCount = 0;
        if (autoSave) {
            for (const announcement of announcements) {
                try {
                    await db.createAnnouncement({
                        ...announcement,
                        createdBy: req.user._id,
                        createdByEmail: req.user.email
                    });
                    savedCount++;
                } catch (error) {
                    console.error('Error saving announcement:', error);
                }
            }
        }

        res.json({ 
            message: autoSave 
                ? `Successfully scraped and saved ${savedCount} of ${announcements.length} announcements`
                : `Successfully scraped ${announcements.length} announcements`,
            count: announcements.length,
            saved: savedCount,
            announcements
        });
    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ error: 'Failed to scrape announcements' });
    }
};

/**
 * Get scraping configuration
 * GET /api/scrape/config
 */
export const getScrapeConfig = async (req, res) => {
    try {
        if (!req.user || !req.user.role.toLowerCase().includes('admin')) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const config = await db.getScrapeConfig();
        res.json(config || { url: '', enabled: false, schedule: '0 */6 * * *' });
    } catch (error) {
        console.error('Error getting scrape config:', error);
        res.status(500).json({ error: 'Failed to get configuration' });
    }
};

/**
 * Save scraping configuration
 * POST /api/scrape/config
 */
export const saveScrapeConfig = async (req, res) => {
    try {
        if (!req.user || !req.user.role.toLowerCase().includes('admin')) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { url, selectors, schedule, enabled } = req.body;
        
        const config = {
            url: url || '',
            selectors: selectors || {},
            schedule: schedule || '0 */6 * * *',
            enabled: enabled || false,
            updatedAt: new Date()
        };

        await db.saveScrapeConfig(config);
        
        res.json({ 
            message: 'Configuration saved successfully',
            config
        });
    } catch (error) {
        console.error('Error saving scrape config:', error);
        res.status(500).json({ error: 'Failed to save configuration' });
    }
};

/**
 * Advanced deep scraping handler
 * POST /api/deep-scrape
 */
export const deepScrapeAnnouncements = async (req, res) => {
    try {
        // Check if user is admin
        if (!req.user || !req.user.role.toLowerCase().includes('admin')) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { url, category, maxDepth = 2, maxPages = 20 } = req.body;
        
        console.log(`Starting deep scrape: URL=${url}, Category=${category}, MaxDepth=${maxDepth}, MaxPages=${maxPages}`);
        
        const results = await deepScrape(url, category, {
            maxDepth: parseInt(maxDepth),
            maxPages: parseInt(maxPages)
        });

        // Store results in database
        let savedCount = 0;
        for (const announcement of results.announcements) {
            try {
                await db.createAnnouncement(announcement);
                savedCount++;
            } catch (error) {
                console.error('Error saving announcement:', error);
            }
        }

        res.json({
            message: `Deep scraping completed. Found ${results.announcements.length} announcements, saved ${savedCount}`,
            stats: results.stats,
            announcements: results.announcements
        });
    } catch (error) {
        console.error('Deep scraping error:', error);
        res.status(500).json({ error: 'Failed to perform deep scraping' });
    }
};
