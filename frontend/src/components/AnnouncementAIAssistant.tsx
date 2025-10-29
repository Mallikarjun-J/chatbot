import React, { useState } from 'react';
// TODO: Frontend should call /api/chat endpoint instead of using AI directly
// import { GoogleGenAI, Type } from "@google/genai";
import { CloseIcon, SparklesIcon, Spinner } from './Icons';

interface AnnouncementAIAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    currentTitle: string;
    currentContent: string;
    onApplySuggestion: (suggestion: { title: string, content: string }) => void;
}

type AITask = 'improve' | 'generate';

const AnnouncementAIAssistant: React.FC<AnnouncementAIAssistantProps> = ({ isOpen, onClose, currentTitle, currentContent, onApplySuggestion }) => {
    const [task, setTask] = useState<AITask>('improve');
    const [prompt, setPrompt] = useState('');
    const [suggestion, setSuggestion] = useState<{ title: string; content: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if ((task === 'generate' && !prompt.trim()) || (task === 'improve' && (!currentTitle.trim() || !currentContent.trim()))) {
            setError('Please provide input for the AI.');
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuggestion(null);

        try {
            let systemInstruction: string;
            let userMessage: string;

            if (task === 'improve') {
                systemInstruction = `You are an expert editor for a college's official announcements. Your goal is to make text clear, professional, and engaging for students and faculty.
                - Review the provided announcement draft.
                - Correct any grammatical errors or typos.
                - Improve sentence structure for better readability.
                - Ensure the tone is appropriate for a campus-wide audience.
                - Return ONLY a valid JSON object with "title" and "content" fields, nothing else.`;
                userMessage = `Please improve this announcement:\n\nTitle: "${currentTitle}"\n\nContent: "${currentContent}"\n\nRespond with JSON: {"title": "improved title", "content": "improved content"}`;
            } else { // generate
                systemInstruction = `You are an AI assistant for a college administrator. Your task is to write a new announcement based on a user's prompt.
                - The tone should be professional, clear, and informative.
                - Create a concise but descriptive title.
                - Write a clear body for the announcement.
                - Return ONLY a valid JSON object with "title" and "content" fields, nothing else.`;
                userMessage = `Please write an announcement based on this prompt: "${prompt}"\n\nRespond with JSON: {"title": "announcement title", "content": "announcement content"}`;
            }

            // Call backend API instead of using Google AI directly
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMessage,
                    history: [], // No history needed for announcement generation
                    context: {
                        role: 'Admin',
                        systemInstruction: systemInstruction,
                        task: 'announcement_' + task,
                        requireJson: true
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to get AI response');
            }

            const data = await response.json();
            
            // Parse the AI response - it should be JSON
            let result;
            try {
                // Try to parse the content as JSON
                const content = data.content.trim();
                // Remove markdown code blocks if present
                const jsonString = content.replace(/```json\n?|\n?```/g, '').trim();
                result = JSON.parse(jsonString);
            } catch (parseError) {
                console.error('Failed to parse AI response as JSON:', data.content);
                throw new Error('AI response was not in the expected format');
            }

            if (!result.title || !result.content) {
                throw new Error('AI response missing required fields');
            }

            setSuggestion(result);

        } catch (err: any) {
            console.error('AI assistant error:', err);
            setError(err.message || "Sorry, the AI couldn't generate a response. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm" aria-modal="true" role="dialog">
            <div className="relative w-full max-w-2xl m-4 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <SparklesIcon className="w-6 h-6 text-red-500" />
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">AI Announcement Assistant</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Close AI Assistant"><CloseIcon className="w-6 h-6" /></button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="flex justify-center gap-2 rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
                        <button onClick={() => setTask('improve')} className={`w-full text-center px-4 py-2 text-sm font-semibold rounded-md transition-colors ${task === 'improve' ? 'bg-white dark:bg-gray-900 text-red-600 dark:text-red-400 shadow' : 'text-gray-500'}`}>Improve Writing</button>
                        <button onClick={() => setTask('generate')} className={`w-full text-center px-4 py-2 text-sm font-semibold rounded-md transition-colors ${task === 'generate' ? 'bg-white dark:bg-gray-900 text-red-600 dark:text-red-400 shadow' : 'text-gray-500'}`}>Generate from Prompt</button>
                    </div>

                    {task === 'improve' ? (
                        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                            <h3 className="font-semibold text-gray-800 dark:text-gray-200">Current Draft</h3>
                            <p className="text-sm font-bold mt-2 truncate">{currentTitle || 'No title provided'}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-3">{currentContent || 'No content provided'}</p>
                        </div>
                    ) : (
                        <div>
                            <label htmlFor="ai-prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Prompt</label>
                            <textarea id="ai-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} placeholder="e.g., Write an announcement about the library being closed this weekend for maintenance." className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                    )}
                    
                    <div className="text-center">
                        <button onClick={handleGenerate} disabled={isLoading} className="w-full max-w-xs mx-auto flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-red-400">
                           {isLoading ? <><Spinner className="w-5 h-5" /><span>Generating...</span></> : <><SparklesIcon className="w-5 h-5" /><span>{task === 'improve' ? 'Improve Text' : 'Generate Announcement'}</span></>}
                        </button>
                    </div>
                    
                    {error && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded-md text-sm"><p>{error}</p></div>}
                    
                    {suggestion && (
                        <div className="p-4 border-2 border-green-500 rounded-lg bg-green-50 dark:bg-green-900/20 space-y-3">
                            <h3 className="font-semibold text-green-800 dark:text-green-300">AI Suggestion</h3>
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">{suggestion.title}</h4>
                                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">{suggestion.content}</p>
                            </div>
                            <div className="text-right">
                                <button onClick={() => onApplySuggestion(suggestion)} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700">Apply Suggestion</button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default AnnouncementAIAssistant;
