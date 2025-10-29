import * as cheerio from 'cheerio';
import axios from 'axios';

/**
 * Basic web scraping function
 * @param {string} url - URL to scrape
 * @param {string} category - Category for announcements (optional)
 * @param {object} customSelectors - Custom CSS selectors (optional)
 * @returns {Promise<Array>} Array of scraped announcements
 */
export async function scrapeWebsite(url, category = 'General', customSelectors = null) {
    try {
        console.log(`Scraping URL: ${url}`);
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const announcements = [];

        // Use custom selectors if provided, otherwise use defaults
        if (customSelectors && customSelectors.container) {
            // Custom selector mode
            $(customSelectors.container).each((i, element) => {
                const $element = $(element);
                
                const title = customSelectors.title 
                    ? $element.find(customSelectors.title).first().text().trim()
                    : $element.find('h1, h2, h3, h4, .title').first().text().trim();

                const content = customSelectors.content
                    ? $element.find(customSelectors.content).text().trim()
                    : $element.find('p, .content, .description').text().trim();

                const date = customSelectors.date
                    ? $element.find(customSelectors.date).text().trim()
                    : '';

                const link = $element.find('a').first().attr('href');
                
                if (title && title.length > 5) {
                    announcements.push({
                        title: title.substring(0, 200),
                        content: content ? content.substring(0, 1000) : title,
                        category: category,
                        date: date || new Date().toISOString(),
                        sourceUrl: link ? new URL(link, url).href : url,
                        scrapedAt: new Date()
                    });
                }
            });
        } else {
            // Default selector mode - try common patterns
            const selectors = [
                'article',
                '.announcement',
                '.post',
                '.news-item',
                '.event',
                'li'
            ];

            for (const selector of selectors) {
                $(selector).each((i, element) => {
                    const $element = $(element);
                    
                    // Extract title
                    const title = $element.find('h1, h2, h3, h4, .title').first().text().trim() ||
                                 $element.find('a').first().text().trim() ||
                                 $element.text().trim().split('\n')[0];

                    // Extract content
                    const content = $element.find('p, .content, .description').text().trim() ||
                                  $element.text().trim();

                    // Extract link
                    const link = $element.find('a').first().attr('href');
                    
                    // Only add if we have meaningful content
                    if (title && title.length > 10 && content && content.length > 20) {
                        announcements.push({
                            title: title.substring(0, 200),
                            content: content.substring(0, 1000),
                            category: category,
                            date: new Date().toISOString(),
                            sourceUrl: link ? new URL(link, url).href : url,
                            scrapedAt: new Date()
                        });
                    }
                });

                // If we found announcements with this selector, stop trying others
                if (announcements.length > 0) {
                    break;
                }
            }
        }

        console.log(`Scraped ${announcements.length} announcements`);
        return announcements;
    } catch (error) {
        console.error('Scraping error:', error.message);
        throw error;
    }
}
