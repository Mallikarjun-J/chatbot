import React, { useState, useEffect } from 'react';
import { ArrowUpOnSquareIcon, Spinner } from './Icons';

interface WebScrapingViewProps {
    onBack: () => void;
}

interface ScrapedPage {
    url: string;
    pageTitle: string;
    metaDescription: string;
    sections: Array<{
        heading: string;
        content: string;
        level: number;
    }>;
    tables: Array<{
        index: number;
        rows: string[][];
    }>;
    links: Array<{
        text: string;
        url: string;
    }>;
    contactInfo: {
        emails: string[];
        phones: string[];
    };
    scrapedAt: string;
    depth: number;
}

interface ScrapeConfig {
    url: string;
    enabled: boolean;
    schedule?: string;
    maxDepth?: number;
}

const WebScrapingView: React.FC<WebScrapingViewProps> = ({ onBack }) => {
    const [url, setUrl] = useState('');
    const [maxDepth, setMaxDepth] = useState(3);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [scrapedPages, setScrapedPages] = useState<ScrapedPage[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [config, setConfig] = useState<ScrapeConfig>({ url: '', enabled: false, maxDepth: 3 });

    // Load existing configuration
    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/scrape/config', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                setConfig(data);
                if (data.url) setUrl(data.url);
                if (data.maxDepth) setMaxDepth(data.maxDepth);
            }
        } catch (err) {
            console.error('Failed to load config:', err);
        }
    };

    const handleScrape = async () => {
        if (!url.trim()) {
            setError('Please enter a valid college website URL.');
            return;
        }
        
        setIsLoading(true);
        setError(null);
        setSuccess(null);
        setScrapedPages([]);
        setStats(null);
        
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/scrape/website', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    url: url.trim(),
                    maxDepth: maxDepth,
                    autoSave: true
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                const errorMsg = data.detail || data.error || data.message || 'Failed to scrape the website';
                throw new Error(errorMsg);
            }
            
            setScrapedPages(data.pages || []);
            setStats(data.stats);
            setSuccess(data.message);
        } catch (err: any) {
            console.error('Scraping error:', err);
            const errorMessage = err.message || 'Failed to scrape the website. Please check the console for details.';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        setIsSaving(true);
        setError(null);
        setSuccess(null);
        
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/scrape/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    url: url.trim(),
                    maxDepth: maxDepth,
                    schedule: config.schedule || '0 0 * * 0',
                    enabled: config.enabled
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to save configuration');
            }
            
            setSuccess('Configuration saved! Automated scraping is ' + (config.enabled ? 'enabled' : 'disabled'));
        } catch (err: any) {
            setError(err.message || 'Failed to save configuration.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg shadow-sm space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-full">
                        <ArrowUpOnSquareIcon className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Knowledge Base Scraper</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Extract all information from your college website</p>
                    </div>
                </div>
                <button onClick={onBack} disabled={isLoading} className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50">
                    &larr; Back to Dashboard
                </button>
            </div>

            {/* Main Scraping Form */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 space-y-4">
                <div>
                    <h4 className="font-semibold text-gray-800 dark:text-white mb-2">🎓 College Website URL</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Enter your college's main website URL. The system will automatically crawl all pages and extract:
                        <span className="block mt-2 font-semibold">
                            📄 Pages • 🎓 Departments • 📢 Announcements • 💼 Placements • 📚 Courses • 🏢 Facilities • 📞 Contact Info
                        </span>
                    </p>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                            Website URL
                        </label>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://yourcollege.edu"
                            className="w-full p-3 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            disabled={isLoading}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                            Crawl Depth (1-5): {maxDepth} levels
                        </label>
                        <input
                            type="range"
                            min="1"
                            max="5"
                            value={maxDepth}
                            onChange={(e) => setMaxDepth(parseInt(e.target.value))}
                            className="w-full"
                            disabled={isLoading}
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>Faster (1)</span>
                            <span>Balanced (3)</span>
                            <span>Complete (5)</span>
                        </div>
                    </div>
                    
                    <button
                        onClick={handleScrape}
                        disabled={isLoading || !url.trim()}
                        className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-md hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 flex items-center justify-center gap-2 font-semibold text-lg"
                    >
                        {isLoading ? (
                            <>
                                <Spinner className="w-6 h-6" />
                                <span>Scraping Website... This may take a few minutes</span>
                            </>
                        ) : (
                            <>
                                <span>🚀</span>
                                <span>Start Complete Website Scrape</span>
                            </>
                        )}
                    </button>
                </div>

                {success && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                        <p className="text-sm text-green-700 dark:text-green-400 font-semibold">✅ {success}</p>
                    </div>
                )}
                
                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                        <p className="text-sm text-red-700 dark:text-red-400 font-semibold">❌ {error}</p>
                    </div>
                )}
            </div>

            {/* Statistics */}
            {stats && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-6 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                    <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-4">📊 Scraping Statistics</h4>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg text-center">
                            <div className="text-3xl font-bold text-blue-600">{stats.totalPages}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Total Pages</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg text-center">
                            <div className="text-3xl font-bold text-green-600">{stats.newPages}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">New Pages</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg text-center">
                            <div className="text-3xl font-bold text-orange-600">{stats.updatedPages}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">Updated Pages</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Scraped Pages */}
            {scrapedPages.length > 0 && (
                <div className="space-y-4">
                    <h4 className="text-lg font-bold text-gray-800 dark:text-white">
                        📚 Scraped Pages ({scrapedPages.length})
                    </h4>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                        {scrapedPages.map((page, index) => (
                            <div key={index} className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h5 className="font-bold text-gray-800 dark:text-white text-lg">{page.pageTitle}</h5>
                                        <a href={page.url} target="_blank" rel="noopener noreferrer" 
                                           className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all">
                                            {page.url}
                                        </a>
                                    </div>
                                    <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                                        Level {page.depth}
                                    </span>
                                </div>
                                
                                {page.metaDescription && (
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 italic">
                                        {page.metaDescription}
                                    </p>
                                )}

                                <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-400">
                                    <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded">
                                        <span className="font-semibold">📝 Sections:</span> {page.sections.length}
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded">
                                        <span className="font-semibold">📊 Tables:</span> {page.tables.length}
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded">
                                        <span className="font-semibold">🔗 Links:</span> {page.links.length}
                                    </div>
                                </div>

                                {(page.contactInfo.emails.length > 0 || page.contactInfo.phones.length > 0) && (
                                    <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                                        <div className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-1">📞 Contact Info Found:</div>
                                        {page.contactInfo.emails.length > 0 && (
                                            <div className="text-xs text-gray-700 dark:text-gray-300">
                                                Emails: {page.contactInfo.emails.join(', ')}
                                            </div>
                                        )}
                                        {page.contactInfo.phones.length > 0 && (
                                            <div className="text-xs text-gray-700 dark:text-gray-300">
                                                Phones: {page.contactInfo.phones.join(', ')}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {page.sections.length > 0 && (
                                    <details className="mt-3">
                                        <summary className="cursor-pointer text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                                            View Content Sections ({page.sections.length})
                                        </summary>
                                        <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
                                            {page.sections.slice(0, 5).map((section, idx) => (
                                                <div key={idx} className="p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs">
                                                    <div className="font-semibold text-gray-800 dark:text-white">
                                                        {section.heading}
                                                    </div>
                                                    <div className="text-gray-600 dark:text-gray-400 line-clamp-2">
                                                        {section.content.substring(0, 200)}...
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Automated Scraping Configuration */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 space-y-4">
                <h4 className="font-semibold text-gray-800 dark:text-white">🤖 Automated Scraping</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Set up automatic scraping to keep your knowledge base updated with the latest information from your college website.
                </p>
                
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.enabled || false}
                            onChange={(e) => setConfig({...config, enabled: e.target.checked})}
                            className="w-5 h-5"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Enable automated scraping</span>
                    </label>
                </div>
                
                <div>
                    <label className="text-sm text-gray-700 dark:text-gray-300 block mb-2">
                        Schedule (Cron format)
                    </label>
                    <input
                        type="text"
                        value={config.schedule || '0 0 * * 0'}
                        onChange={(e) => setConfig({...config, schedule: e.target.value})}
                        placeholder="0 0 * * 0"
                        className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                    />
                    <p className="text-xs text-gray-500 mt-1">Default: Every Sunday at midnight (0 0 * * 0)</p>
                </div>
                
                <button
                    onClick={handleSaveConfig}
                    disabled={isSaving || !url.trim()}
                    className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
                >
                    {isSaving ? <Spinner className="w-4 h-4" /> : '💾'} Save Configuration
                </button>
            </div>
        </div>
    );
};

export default WebScrapingView;
