import React, { useState, useEffect } from 'react';
import { ArrowUpOnSquareIcon, Spinner } from './Icons';

interface WebScrapingViewProps {
    onBack: () => void;
}

interface ScrapedAnnouncement {
    title: string;
    content: string;
    date: string;
    source: string;
}

interface ScrapeConfig {
    url: string;
    selectors?: {
        title?: string;
        content?: string;
        date?: string;
        container?: string;
    };
    schedule?: string;
    enabled?: boolean;
}

const WebScrapingView: React.FC<WebScrapingViewProps> = ({ onBack }) => {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [scrapedData, setScrapedData] = useState<ScrapedAnnouncement[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [config, setConfig] = useState<ScrapeConfig>({ url: '', enabled: false });
    
    // Advanced selectors
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [selectors, setSelectors] = useState({
        container: '',
        title: '',
        content: '',
        date: ''
    });

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
                if (data.selectors) setSelectors(data.selectors);
            }
        } catch (err) {
            console.error('Failed to load config:', err);
        }
    };

    const handleScrape = async (autoSave = false) => {
        if (!url.trim()) {
            setError('Please enter a valid URL.');
            return;
        }
        
        setIsLoading(true);
        setError(null);
        setSuccess(null);
        setScrapedData([]);
        
        try {
            const token = localStorage.getItem('authToken');
            const response = await fetch('/api/scrape/announcements', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    url: url.trim(),
                    selectors: showAdvanced && selectors.container ? selectors : undefined,
                    autoSave
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to scrape the URL');
            }
            
            setScrapedData(data.announcements || []);
            setSuccess(data.message);
        } catch (err: any) {
            setError(err.message || 'Failed to scrape the URL.');
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
                    selectors: showAdvanced && selectors.container ? selectors : {},
                    schedule: config.schedule || '0 */6 * * *',
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
                    <div className="bg-red-100 dark:bg-red-900/50 p-3 rounded-full">
                        <ArrowUpOnSquareIcon className="w-6 h-6 text-red-500" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white">College Website Scraper</h3>
                </div>
                <button onClick={onBack} disabled={isLoading} className="text-sm font-semibold text-red-600 dark:text-red-400 hover:underline disabled:opacity-50">
                    &larr; Back to Dashboard
                </button>
            </div>

            {/* Main Scraping Form */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 space-y-4">
                <div>
                    <h4 className="font-semibold text-gray-800 dark:text-white mb-2">College Announcements URL</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Enter your college website's announcements or news page URL. The system will automatically extract announcements.
                    </p>
                </div>
                
                <div className="space-y-3">
                    <input
                        type="url"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://yourcollege.edu/announcements"
                        className="w-full p-3 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        disabled={isLoading}
                    />
                    
                    {/* Advanced Selectors Toggle */}
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        {showAdvanced ? '▼' : '▶'} Advanced CSS Selectors (Optional)
                    </button>
                    
                    {showAdvanced && (
                        <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-md">
                            <div>
                                <label className="text-xs text-gray-600 dark:text-gray-400">Container Selector</label>
                                <input
                                    type="text"
                                    value={selectors.container}
                                    onChange={(e) => setSelectors({...selectors, container: e.target.value})}
                                    placeholder=".announcement, article"
                                    className="w-full p-2 text-sm border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-600"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-600 dark:text-gray-400">Title Selector</label>
                                <input
                                    type="text"
                                    value={selectors.title}
                                    onChange={(e) => setSelectors({...selectors, title: e.target.value})}
                                    placeholder="h2, .title"
                                    className="w-full p-2 text-sm border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-600"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-600 dark:text-gray-400">Content Selector</label>
                                <input
                                    type="text"
                                    value={selectors.content}
                                    onChange={(e) => setSelectors({...selectors, content: e.target.value})}
                                    placeholder="p, .content"
                                    className="w-full p-2 text-sm border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-600"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-600 dark:text-gray-400">Date Selector</label>
                                <input
                                    type="text"
                                    value={selectors.date}
                                    onChange={(e) => setSelectors({...selectors, date: e.target.value})}
                                    placeholder=".date, time"
                                    className="w-full p-2 text-sm border border-gray-300 rounded dark:bg-gray-800 dark:border-gray-600"
                                />
                            </div>
                        </div>
                    )}
                    
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleScrape(false)}
                            disabled={isLoading || !url.trim()}
                            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2 font-semibold"
                        >
                            {isLoading ? <Spinner className="w-5 h-5" /> : '🔍'} Preview Scrape
                        </button>
                        <button
                            onClick={() => handleScrape(true)}
                            disabled={isLoading || !url.trim()}
                            className="flex-1 px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2 font-semibold"
                        >
                            {isLoading ? <Spinner className="w-5 h-5" /> : '💾'} Scrape & Save
                        </button>
                    </div>
                </div>

                {success && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
                        <p className="text-sm text-green-700 dark:text-green-400">✅ {success}</p>
                    </div>
                )}
                
                {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                        <p className="text-sm text-red-700 dark:text-red-400">❌ {error}</p>
                    </div>
                )}
            </div>

            {/* Scraped Results */}
            {scrapedData.length > 0 && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-800 dark:text-white mb-4">
                        📋 Found {scrapedData.length} Announcements
                    </h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {scrapedData.map((item, index) => (
                            <div key={index} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-700">
                                <h5 className="font-semibold text-gray-800 dark:text-white">{item.title}</h5>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{item.content}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">📅 {item.date}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Automated Scraping Configuration */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700 space-y-4">
                <h4 className="font-semibold text-gray-800 dark:text-white">🤖 Automated Scraping</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    Set up automatic scraping to fetch announcements from your college website periodically.
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
                        value={config.schedule || '0 */6 * * *'}
                        onChange={(e) => setConfig({...config, schedule: e.target.value})}
                        placeholder="0 */6 * * *"
                        className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600"
                    />
                    <p className="text-xs text-gray-500 mt-1">Default: Every 6 hours (0 */6 * * *)</p>
                </div>
                
                <button
                    onClick={handleSaveConfig}
                    disabled={isSaving || !url.trim()}
                    className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 flex items-center gap-2"
                >
                    {isSaving ? <Spinner className="w-4 h-4" /> : '💾'} Save Configuration
                </button>
            </div>
        </div>
    );
};

export default WebScrapingView;
