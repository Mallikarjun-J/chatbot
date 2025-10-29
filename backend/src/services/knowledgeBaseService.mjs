import { db } from '../database.mjs';

/**
 * Build knowledge base from announcements
 * @param {string|null} category - Optional category filter
 * @returns {Promise<string>} Formatted knowledge base text
 */
export async function buildKnowledgeBase(category = null) {
    try {
        // Fetch announcements from database
        let announcements = await db.getAnnouncements();
        
        // Filter by category if specified
        if (category) {
            announcements = announcements.filter(a => a.category === category);
        }
        
        console.log(`Building knowledge base: Found ${announcements.length} announcements` + (category ? ` in category "${category}"` : ''));

        if (announcements.length === 0) {
            return 'No announcements available at this time.';
        }

        // Format announcements into knowledge base
        let knowledge = 'Campus Announcements:\n\n';
        
        announcements.forEach((announcement, index) => {
            knowledge += `${index + 1}. ${announcement.title}\n`;
            knowledge += `   ${announcement.content}\n`;
            
            if (announcement.category) {
                knowledge += `   Category: ${announcement.category}\n`;
            }
            
            if (announcement.eventDate) {
                knowledge += `   Date: ${new Date(announcement.eventDate).toLocaleDateString()}\n`;
            }
            
            if (announcement.eventTime) {
                knowledge += `   Time: ${announcement.eventTime}\n`;
            }
            
            if (announcement.location) {
                knowledge += `   Location: ${announcement.location}\n`;
            }
            
            if (announcement.sourceUrl) {
                knowledge += `   Source: ${announcement.sourceUrl}\n`;
            }
            
            knowledge += '\n';
        });

        return knowledge;
    } catch (error) {
        console.error('Error building knowledge base:', error);
        return 'Unable to load campus announcements at this time.';
    }
}
