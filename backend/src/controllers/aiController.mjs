import { GoogleGenAI } from '@google/genai';
import { config } from '../config/index.mjs';
import { buildKnowledgeBase } from '../services/knowledgeBaseService.mjs';

// Initialize Gemini AI
const genAI = new GoogleGenAI({ apiKey: config.geminiApiKey });

/**
 * AI chatbot handler
 * POST /api/chat
 */
export const chatWithAI = async (req, res) => {
    try {
        const { message, category } = req.body;

        // Build knowledge base from announcements
        const knowledge = await buildKnowledgeBase(category);

        // Create system prompt
        const systemInstruction = `You are a helpful campus assistant for a college/university.

IMPORTANT INSTRUCTIONS:
1. Give SHORT and CONCISE answers (2-3 sentences maximum)
2. Only provide the most relevant information
3. Don't repeat information unnecessarily
4. Be direct and to the point

You have access to the following campus information:
${knowledge}

Answer the student's question based ONLY on the information provided above. If the information is not available, politely say you don't have that information. Keep your response brief and focused.`;

        const contents = [{
            role: 'user',
            parts: [{ text: message }]
        }];

        // Try with retry logic and fallback models
        const models = ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro'];
        let lastError = null;
        
        for (const modelName of models) {
            try {
                console.log(`🤖 Using model: ${modelName}`);
                const result = await genAI.models.generateContent({
                    model: modelName,
                    contents: contents,
                    config: {
                        systemInstruction: systemInstruction,
                        temperature: 0.7,
                        maxOutputTokens: 500, // Short responses
                    }
                });
                
                const responseText = result.text || result.response?.text?.() || 'Sorry, I could not generate a response.';
                
                return res.json({ 
                    content: responseText,
                    model: modelName,
                    sources: [],
                    knowledgeBase: {
                        announcementsUsed: 0,
                        liveDataFetched: false,
                        placementsFound: 0,
                        eventsFound: 0
                    }
                });
            } catch (modelError) {
                console.error(`Model ${modelName} failed:`, modelError.message);
                lastError = modelError;
                continue;
            }
        }
        
        // If all models failed
        throw lastError || new Error('All AI models failed');
    } catch (error) {
        console.error('AI chat error:', error);
        res.status(500).json({ error: 'Failed to process chat message' });
    }
};
