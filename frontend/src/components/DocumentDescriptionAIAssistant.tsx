import React, { useState } from 'react';
import { CloseIcon, SparklesIcon, Spinner } from './Icons';

interface DocumentDescriptionAIAssistantProps {
    isOpen: boolean;
    onClose: () => void;
    documentName: string;
    documentType: string;
    subject: string;
    semester: string;
    branch: string;
    currentDescription: string;
    onApplySuggestion: (description: string) => void;
}

const DocumentDescriptionAIAssistant: React.FC<DocumentDescriptionAIAssistantProps> = ({
    isOpen,
    onClose,
    documentName,
    documentType,
    subject,
    semester,
    branch,
    currentDescription,
    onApplySuggestion
}) => {
    const [customPrompt, setCustomPrompt] = useState('');
    const [suggestion, setSuggestion] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [useCustomPrompt, setUseCustomPrompt] = useState(false);

    const handleGenerate = async () => {
        setIsLoading(true);
        setError(null);
        setSuggestion(null);

        try {
            let userMessage: string;
            const systemInstruction = `You are an AI assistant helping college administrators write clear, concise descriptions for educational documents.
- The description should be professional and informative
- Keep it brief (1-3 sentences)
- Highlight what the document contains and why it's useful
- Use appropriate academic tone
- Return ONLY the description text, no JSON, no quotes, no formatting`;

            if (useCustomPrompt && customPrompt.trim()) {
                userMessage = `Write a description for a college document based on this prompt: "${customPrompt}"\n\nDocument details:\n- Name: ${documentName}\n- Type: ${documentType}\n- Subject: ${subject}\n- Semester: ${semester}\n${branch ? `- Branch: ${branch}` : ''}`;
            } else {
                userMessage = `Write a brief description for this college document:\n\nDocument Name: ${documentName}\nType: ${documentType}\nSubject: ${subject}\nSemester: ${semester}${branch ? `\nBranch: ${branch}` : ''}\n${currentDescription ? `\nCurrent description: ${currentDescription}` : ''}\n\nProvide a clear, concise description (1-3 sentences).`;
            }

            // Call backend API
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: userMessage,
                    history: [],
                    context: {
                        role: 'Admin',
                        systemInstruction: systemInstruction,
                        task: 'document_description',
                        requireJson: false
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to get AI response');
            }

            const data = await response.json();
            const description = data.content.trim();

            if (!description) {
                throw new Error('AI response was empty');
            }

            setSuggestion(description);

        } catch (err: any) {
            console.error('AI assistant error:', err);
            setError(err.message || "Sorry, the AI couldn't generate a response. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleApply = () => {
        if (suggestion) {
            onApplySuggestion(suggestion);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm" aria-modal="true" role="dialog">
            <div className="relative w-full max-w-2xl m-4 bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <SparklesIcon className="w-6 h-6 text-red-500" />
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white">AI Description Assistant</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Close AI Assistant">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Document Info */}
                    <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900/50">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Document Details</h3>
                        <div className="text-sm space-y-1">
                            <p><span className="font-medium">Name:</span> {documentName || 'Not provided'}</p>
                            <p><span className="font-medium">Type:</span> {documentType || 'Not selected'}</p>
                            <p><span className="font-medium">Subject:</span> {subject || 'Not provided'}</p>
                            <p><span className="font-medium">Semester:</span> {semester || 'Not selected'}</p>
                            {branch && <p><span className="font-medium">Branch:</span> {branch}</p>}
                            {currentDescription && (
                                <p className="mt-2"><span className="font-medium">Current:</span> <span className="text-gray-600 dark:text-gray-400">{currentDescription}</span></p>
                            )}
                        </div>
                    </div>

                    {/* Custom Prompt Toggle */}
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="custom-prompt"
                            checked={useCustomPrompt}
                            onChange={(e) => setUseCustomPrompt(e.target.checked)}
                            className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                        />
                        <label htmlFor="custom-prompt" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Use custom prompt
                        </label>
                    </div>

                    {/* Custom Prompt Input */}
                    {useCustomPrompt && (
                        <div>
                            <label htmlFor="ai-prompt" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Custom Prompt
                            </label>
                            <textarea
                                id="ai-prompt"
                                value={customPrompt}
                                onChange={(e) => setCustomPrompt(e.target.value)}
                                rows={3}
                                placeholder="e.g., Focus on the practical applications covered in this document..."
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            />
                        </div>
                    )}

                    {/* Generate Button */}
                    <div className="text-center">
                        <button
                            onClick={handleGenerate}
                            disabled={isLoading || !documentName || !documentType || !subject || !semester}
                            className="w-full max-w-xs mx-auto flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors"
                        >
                            {isLoading ? (
                                <>
                                    <Spinner className="w-5 h-5" />
                                    <span>Generating...</span>
                                </>
                            ) : (
                                <>
                                    <SparklesIcon className="w-5 h-5" />
                                    <span>Generate Description</span>
                                </>
                            )}
                        </button>
                        {(!documentName || !documentType || !subject || !semester) && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                Please fill in document details first
                            </p>
                        )}
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 rounded-md text-sm">
                            <p>{error}</p>
                        </div>
                    )}

                    {/* Suggestion Display */}
                    {suggestion && (
                        <div className="p-4 border-2 border-green-500 rounded-lg bg-green-50 dark:bg-green-900/20 space-y-3">
                            <h3 className="font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
                                <SparklesIcon className="w-5 h-5" />
                                AI Generated Description
                            </h3>
                            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">{suggestion}</p>
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={handleApply}
                                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
                                >
                                    Apply Description
                                </button>
                                <button
                                    onClick={handleGenerate}
                                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md text-sm font-medium transition-colors"
                                >
                                    Regenerate
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DocumentDescriptionAIAssistant;
