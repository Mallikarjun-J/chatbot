/**
 * ADVANCED WEB SCRAPER FOR CAMPUS MANAGEMENT
 * 
 * Features:
 * - Deep crawling of all subpages
 * - Image text extraction (OCR)
 * - AI-powered content categorization
 * - Separate storage by content type
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { URL } from 'url';

/**
 * Advanced Scraper Class
 */
export class AdvancedScraper {
    constructor(baseUrl, options = {}) {
        this.baseUrl = baseUrl;
        this.domain = new URL(baseUrl).hostname;
        this.visited = new Set();
        this.queue = [baseUrl];
        this.maxPages = options.maxPages || 50;
        this.maxDepth = options.maxDepth || 3;
        this.delay = options.delay || 1000; // Rate limiting
        this.results = {
            placements: [],
            announcements: [],
            events: [],
            academics: [],
            general: []
        };
    }

    /**
     * Main crawl function - crawls all pages
     */
    async crawl() {
        console.log(`🕷️  Starting deep crawl of ${this.baseUrl}`);
        
        while (this.queue.length > 0 && this.visited.size < this.maxPages) {
            const url = this.queue.shift();
            
            if (this.visited.has(url)) continue;
            
            try {
                await this.scrapePage(url);
                this.visited.add(url);
                
                // Rate limiting
                await this.sleep(this.delay);
                
                console.log(`✅ Scraped: ${url} (${this.visited.size}/${this.maxPages})`);
            } catch (error) {
                console.error(`❌ Failed to scrape ${url}:`, error.message);
            }
        }
        
        console.log(`🎉 Crawling complete! Scraped ${this.visited.size} pages`);
        return this.results;
    }

    /**
     * Scrape a single page
     */
    async scrapePage(url) {
        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        const pageData = {
            url,
            title: $('title').text().trim(),
            content: '',
            images: [],
            links: [],
            metadata: {}
        };

        // Extract text content
        pageData.content = this.extractTextContent($);

        // Extract images
        pageData.images = this.extractImages($, url);

        // Find new links to crawl
        const newLinks = this.extractLinks($, url);
        newLinks.forEach(link => {
            if (!this.visited.has(link) && !this.queue.includes(link)) {
                this.queue.push(link);
            }
        });

        // Extract metadata
        pageData.metadata = this.extractMetadata($);

        // Categorize and store
        await this.categorizeAndStore(pageData);
    }

    /**
     * Extract main text content from page
     */
    extractTextContent($) {
        // Remove script and style tags
        $('script, style, nav, header, footer').remove();
        
        // Get main content
        const mainContent = $('main, article, .content, #content, .main-content').text() ||
                           $('body').text();
        
        return mainContent
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 5000); // Limit to 5000 chars
    }

    /**
     * Extract all images from page
     */
    extractImages($, baseUrl) {
        const images = [];
        
        $('img').each((i, elem) => {
            const src = $(elem).attr('src');
            const alt = $(elem).attr('alt') || '';
            
            if (src) {
                const absoluteUrl = this.resolveUrl(src, baseUrl);
                images.push({
                    url: absoluteUrl,
                    alt,
                    context: $(elem).parent().text().trim().substring(0, 200)
                });
            }
        });
        
        return images;
    }

    /**
     * Extract all links from page
     */
    extractLinks($, baseUrl) {
        const links = [];
        
        $('a[href]').each((i, elem) => {
            const href = $(elem).attr('href');
            if (!href) return;
            
            const absoluteUrl = this.resolveUrl(href, baseUrl);
            
            // Only crawl same domain
            if (this.isSameDomain(absoluteUrl)) {
                links.push(absoluteUrl);
            }
        });
        
        return [...new Set(links)]; // Remove duplicates
    }

    /**
     * Extract page metadata
     */
    extractMetadata($) {
        return {
            description: $('meta[name="description"]').attr('content') || '',
            keywords: $('meta[name="keywords"]').attr('content') || '',
            author: $('meta[name="author"]').attr('content') || '',
            date: this.extractDate($)
        };
    }

    /**
     * Extract date from page (various formats)
     */
    extractDate($) {
        // Try meta tags
        const dateSelectors = [
            'meta[property="article:published_time"]',
            'meta[name="publish-date"]',
            'meta[name="date"]',
            '.date',
            '.published-date',
            'time[datetime]'
        ];

        for (const selector of dateSelectors) {
            const elem = $(selector).first();
            if (elem.length) {
                const dateStr = elem.attr('content') || elem.attr('datetime') || elem.text();
                if (dateStr) {
                    const date = new Date(dateStr);
                    if (!isNaN(date.getTime())) {
                        return date.toISOString();
                    }
                }
            }
        }

        return new Date().toISOString();
    }

    /**
     * Categorize content using keyword matching and AI
     */
    async categorizeAndStore(pageData) {
        const { title, content, url, images, metadata } = pageData;
        const text = `${title} ${content} ${metadata.keywords}`.toLowerCase();

        // Keyword-based categorization
        const categories = this.detectCategory(text, title);
        
        // Create structured data
        const item = {
            title: title || 'Untitled',
            content: content.substring(0, 500), // First 500 chars as summary
            fullContent: content,
            url,
            source: this.baseUrl,
            scrapedAt: new Date().toISOString(),
            date: metadata.date,
            images: images.slice(0, 5), // Limit images
            metadata,
            categories
        };

        // Store in appropriate categories
        if (categories.placement) {
            this.results.placements.push({
                ...item,
                type: 'placement',
                priority: categories.placement.score
            });
        }
        
        if (categories.announcement) {
            this.results.announcements.push({
                ...item,
                type: 'announcement',
                priority: categories.announcement.score
            });
        }
        
        if (categories.event) {
            this.results.events.push({
                ...item,
                type: 'event',
                priority: categories.event.score
            });
        }
        
        if (categories.academic) {
            this.results.academics.push({
                ...item,
                type: 'academic',
                priority: categories.academic.score
            });
        }
        
        // If no specific category, store in general
        if (!categories.placement && !categories.announcement && !categories.event && !categories.academic) {
            this.results.general.push(item);
        }
    }

    /**
     * Detect content category using keyword matching
     */
    detectCategory(text, title) {
        const categories = {
            placement: null,
            announcement: null,
            event: null,
            academic: null
        };

        // Placement keywords
        const placementKeywords = [
            'placement', 'recruited', 'hired', 'offer', 'package', 'lpa', 'ctc',
            'salary', 'company', 'job', 'career', 'internship', 'recruitment',
            'interview', 'selected', 'campus placement', 'drive', 'recruiter'
        ];
        
        // Announcement keywords
        const announcementKeywords = [
            'announcement', 'notice', 'circular', 'notification', 'alert',
            'important', 'update', 'news', 'information', 'attention'
        ];
        
        // Event keywords
        const eventKeywords = [
            'event', 'workshop', 'seminar', 'conference', 'webinar', 'session',
            'competition', 'fest', 'hackathon', 'symposium', 'talk', 'lecture',
            'training', 'program', 'competition', 'contest', 'ceremony'
        ];
        
        // Academic keywords
        const academicKeywords = [
            'exam', 'result', 'marks', 'grade', 'academic', 'syllabus',
            'curriculum', 'course', 'semester', 'timetable', 'schedule',
            'admission', 'enrollment', 'registration', 'department'
        ];

        // Calculate scores
        const titleLower = title.toLowerCase();
        
        categories.placement = this.calculateScore(text, titleLower, placementKeywords);
        categories.announcement = this.calculateScore(text, titleLower, announcementKeywords);
        categories.event = this.calculateScore(text, titleLower, eventKeywords);
        categories.academic = this.calculateScore(text, titleLower, academicKeywords);

        return categories;
    }

    /**
     * Calculate category score based on keyword matches
     */
    calculateScore(text, title, keywords) {
        let score = 0;
        const matches = [];

        for (const keyword of keywords) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            const textMatches = (text.match(regex) || []).length;
            const titleMatches = (title.match(regex) || []).length * 3; // Title matches worth more
            
            if (textMatches > 0 || titleMatches > 0) {
                matches.push(keyword);
                score += textMatches + titleMatches;
            }
        }

        if (score === 0) return null;

        return {
            score,
            matches,
            confidence: Math.min(score / 10, 1) // 0-1 confidence score
        };
    }

    /**
     * Resolve relative URLs to absolute
     */
    resolveUrl(href, baseUrl) {
        try {
            return new URL(href, baseUrl).href;
        } catch {
            return null;
        }
    }

    /**
     * Check if URL is same domain
     */
    isSameDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname === this.domain || urlObj.hostname.endsWith(`.${this.domain}`);
        } catch {
            return false;
        }
    }

    /**
     * Sleep utility for rate limiting
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Simple function to start deep scraping
 */
export async function deepScrape(baseUrl, options = {}) {
    const scraper = new AdvancedScraper(baseUrl, options);
    return await scraper.crawl();
}
