import React, { useState, useEffect } from 'react';
import { ArrowUpOnSquareIcon, Spinner } from './Icons';

interface WebScrapingViewProps {
    onBack: () => void;
}

interface KnowledgeBaseEntry {
    id: string;
    url: string;
    pageTitle: string;
    metaDescription: string;
    summary: string;
    scrapedAt: string;
    sections: Array<{
        heading: string;
        content: string;
        level: number;
    }>;
    links: Array<{
        text: string;
        url: string;
    }>;
    tables: Array<{
        index: number;
        rows: string[][];
    }>;
    contactInfo: {
        emails: string[];
        phones: string[];
    };
}

const WebScrapingView: React.FC<WebScrapingViewProps> = ({ onBack }) => {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [scrapedData, setScrapedData] = useState<ScrapedAnnouncement[]>([]);
    const [classifiedData, setClassifiedData] = useState<ClassifiedData | null>(null);
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
        setClassifiedData(null);
        
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
            
            // Handle classified data
            if (data.classified) {
                setClassifiedData(data.classified);
            } else {
                setScrapedData(data.announcements || []);
            }
            
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

            {/* Classified Results */}
            {classifiedData && (
                <div className="space-y-4">
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                        <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-2">
                            🎯 Classification Results (Academic Year 2024-2025)
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {classifiedData.filtered ? `Filtered out ${classifiedData.filtered} old items. ` : ''}
                            Showing only current academic year data.
                        </p>
                    </div>

                    {/* Announcements */}
                    {classifiedData.announcements.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow border-l-4 border-blue-500">
                            <h5 className="font-bold text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-2">
                                📢 General Announcements ({classifiedData.announcements.length})
                            </h5>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {classifiedData.announcements.map((item, index) => (
                                    <div key={index} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                                        <h6 className="font-semibold text-sm text-gray-800 dark:text-white">{item.title}</h6>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{item.content}</p>
                                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">📅 {item.date}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Placements */}
                    {classifiedData.placements.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow border-l-4 border-green-500">
                            <h5 className="font-bold text-green-600 dark:text-green-400 mb-3 flex items-center gap-2">
                                💼 Placements & Jobs ({classifiedData.placements.length})
                            </h5>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {classifiedData.placements.map((item, index) => (
                                    <div key={index} className="p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                                        <h6 className="font-semibold text-sm text-gray-800 dark:text-white">{item.title}</h6>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{item.content}</p>
                                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">📅 {item.date}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Events */}
                    {classifiedData.events.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow border-l-4 border-orange-500">
                            <h5 className="font-bold text-orange-600 dark:text-orange-400 mb-3 flex items-center gap-2">
                                🎉 Events & Activities ({classifiedData.events.length})
                            </h5>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {classifiedData.events.map((item, index) => (
                                    <div key={index} className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800">
                                        <h6 className="font-semibold text-sm text-gray-800 dark:text-white">{item.title}</h6>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{item.content}</p>
                                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">📅 {item.date}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Examinations */}
                    {classifiedData.examinations.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow border-l-4 border-red-500">
                            <h5 className="font-bold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
                                📝 Examinations & Tests ({classifiedData.examinations.length})
                            </h5>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {classifiedData.examinations.map((item, index) => (
                                    <div key={index} className="p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                                        <h6 className="font-semibold text-sm text-gray-800 dark:text-white">{item.title}</h6>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{item.content}</p>
                                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">📅 {item.date}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Holidays */}
                    {classifiedData.holidays.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow border-l-4 border-pink-500">
                            <h5 className="font-bold text-pink-600 dark:text-pink-400 mb-3 flex items-center gap-2">
                                🏖️ Holidays & Breaks ({classifiedData.holidays.length})
                            </h5>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {classifiedData.holidays.map((item, index) => (
                                    <div key={index} className="p-3 bg-pink-50 dark:bg-pink-900/20 rounded border border-pink-200 dark:border-pink-800">
                                        <h6 className="font-semibold text-sm text-gray-800 dark:text-white">{item.title}</h6>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{item.content}</p>
                                        <p className="text-xs text-pink-600 dark:text-pink-400 mt-1">📅 {item.date}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Documents */}
                    {classifiedData.documents.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow border-l-4 border-purple-500">
                            <h5 className="font-bold text-purple-600 dark:text-purple-400 mb-3 flex items-center gap-2">
                                � Documents & Forms ({classifiedData.documents.length})
                            </h5>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {classifiedData.documents.map((item, index) => (
                                    <div key={index} className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
                                        <h6 className="font-semibold text-sm text-gray-800 dark:text-white">{item.title}</h6>
                                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{item.content}</p>
                                        <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">📅 {item.date}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {classifiedData.announcements.length === 0 && 
                     classifiedData.placements.length === 0 && 
                     classifiedData.events.length === 0 && 
                     classifiedData.examinations.length === 0 && 
                     classifiedData.holidays.length === 0 && 
                     classifiedData.documents.length === 0 && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-lg border-2 border-yellow-200 dark:border-yellow-800 text-center">
                            <p className="text-yellow-700 dark:text-yellow-400 font-semibold">
                                ⚠️ No current academic year data found. All items were filtered out as old.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Scraped Results (fallback) */}
            {scrapedData.length > 0 && !classifiedData && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-800 dark:text-white mb-4">
                        📋 Found {scrapedData.length} Items
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
