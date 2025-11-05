const axios = require('axios');
const Customer = require('../models/customer');

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const ALT_MODELS = (process.env.GEMINI_ALT_MODELS || 'gemini-1.5-pro').split(',').map(s => s.trim()).filter(Boolean);

// Generate AI response using Google Gemini API
const generateRecipeResponse = async (req, res) => {
    try {
        const { message, conversationHistory, customerId } = req.body;
        if (!customerId) {
            return res.status(400).json({ success: false, message: 'Missing customerId' });
        }

        // Atomic credit check & decrement
        const updated = await Customer.findOneAndUpdate(
            { _id: customerId, credits: { $gt: 0 } },
            { $inc: { credits: -1 } },
            { new: true }
        );
        if (!updated) {
            return res.status(402).json({ success: false, message: 'Insufficient credits. Please purchase more to continue.' });
        }
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: 'Gemini API key not configured'
            });
        }

        // Build conversation context for Gemini
        let conversationText = `You are a professional chef and recipe assistant. Your role is to:
- Help users create delicious recipes based on their ingredients
- Provide cooking instructions that are clear and easy to follow
- Suggest ingredient substitutions when needed
- Accommodate dietary restrictions and preferences
- Offer cooking tips and techniques
- Be enthusiastic and encouraging about cooking

Always respond in a friendly, helpful manner. When providing recipes, include:
1. Ingredient list with measurements
2. Step-by-step instructions
3. Cooking time and difficulty level
4. Optional tips or variations

Keep responses concise but informative. Use emojis occasionally to make the conversation engaging.

`;

        // Add conversation history if provided
        if (conversationHistory && Array.isArray(conversationHistory)) {
            conversationHistory.forEach(msg => {
                const role = msg.sender === 'user' ? 'User' : 'Assistant';
                conversationText += `${role}: ${msg.message}\n`;
            });
        }

        // Add current user message
        conversationText += `User: ${message}\nAssistant:`;

        // Helper to call Gemini with retries and alternate models
        const callGemini = async (modelName) => {
            return axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
                {
                    contents: [{ parts: [{ text: conversationText }] }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1000
                    }
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 20000
                }
            );
        };

        let response;
        try {
            response = await callGemini(GEMINI_MODEL);
        } catch (primaryErr) {
            // On rate limit or model error, try alternates once
            const status = primaryErr.response?.status;
            const retriable = status === 429 || status === 500 || primaryErr.code === 'ECONNABORTED';
            if (retriable && ALT_MODELS.length > 0) {
                try {
                    response = await callGemini(ALT_MODELS[0]);
                } catch (altErr) {
                    throw altErr; // bubble to outer catch
                }
            } else {
                throw primaryErr;
            }
        }

        const aiMessage = response.data.candidates[0].content.parts[0].text;

        res.status(200).json({
            success: true,
            message: aiMessage,
            tokensUsed: response.data.usageMetadata?.totalTokenCount || 0,
            credits: updated.credits
        });

    } catch (error) {
        console.error('Gemini API Error:', error.response?.data || error.message);

        // Refund credit on recoverable errors (rate limit, timeout, server error)
        try {
            const status = error.response?.status;
            if (status === 429 || status === 500 || error.code === 'ECONNABORTED') {
                await Customer.updateOne({ _id: req.body.customerId }, { $inc: { credits: 1 } });
            }
        } catch (refundErr) {
            console.warn('Credit refund failed:', refundErr.message);
        }

        const statusCode = error.response?.status === 429 ? 429 : 500;
        // Provide fallback response
        res.status(statusCode).json({
            success: false,
            message: statusCode === 429 ? 'Service temporarily busy. Please try again shortly.' : 'Error generating AI response',
            error: error.response?.data?.error?.message || error.message,
            fallbackResponse: getFallbackResponse(req.body.message)
        });
    }
};

// Fallback response when OpenAI is unavailable
const getFallbackResponse = (userInput) => {
    const input = userInput?.toLowerCase() || '';
    
    if (input.includes('pasta') || input.includes('spaghetti')) {
        return "🍝 Great choice! I can help you make delicious pasta. Do you prefer a classic tomato-based sauce, creamy alfredo, or something with pesto? Also, let me know if you have any dietary restrictions!";
    } else if (input.includes('chicken') || input.includes('meat')) {
        return "🍗 Chicken is versatile! Are you in the mood for something grilled, baked, or perhaps a curry? What's your skill level - beginner, intermediate, or advanced?";
    } else if (input.includes('vegetarian') || input.includes('vegan')) {
        return "🥗 Excellent! I have many plant-based recipes. What ingredients do you have on hand? Some common ones like beans, lentils, tofu, or vegetables?";
    } else if (input.includes('quick') || input.includes('fast')) {
        return "⚡ I understand you're short on time! I can suggest recipes that take 30 minutes or less. What ingredients do you have available?";
    } else if (input.includes('dessert') || input.includes('sweet')) {
        return "🍰 Sweet tooth calling! Are you interested in cakes, cookies, puddings, or something refreshing like ice cream? Do you have baking supplies?";
    } else {
        return `I'm here to help you create amazing recipes! To give you the best suggestions, please tell me:\n\n1. What ingredients do you have?\n2. Any dietary preferences or restrictions?\n3. Your cooking skill level?\n4. How much time do you have?\n\nLet's create something delicious together! 🍳`;
    }
};

// Generate a complete recipe from ingredients
const generateCompleteRecipe = async (req, res) => {
    try {
        const { ingredients, preferences, skillLevel, cookingTime } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: 'Gemini API key not configured'
            });
        }

        const prompt = `Create a detailed recipe using these ingredients: ${ingredients.join(', ')}.

Preferences: ${preferences || 'None'}
Skill Level: ${skillLevel || 'Intermediate'}
Time Available: ${cookingTime || '30-60 minutes'}

Please provide:
1. Recipe Title
2. Servings
3. Prep Time and Cook Time
4. Complete ingredient list with measurements
5. Detailed step-by-step instructions
6. Nutritional information (approximate)
7. Chef's tips or variations

Format the response in a clear, easy-to-read structure.`;

        const response = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.8,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1500
                }
            },
            {
                headers: {
                    'Content-Type': 'application/json'
                }
            }
        );

        const recipe = response.data.candidates[0].content.parts[0].text;

        res.status(200).json({
            success: true,
            recipe: recipe,
            tokensUsed: response.data.usageMetadata?.totalTokenCount || 0
        });

    } catch (error) {
        console.error('Gemini Recipe Generation Error:', error.response?.data || error.message);
        res.status(500).json({
            success: false,
            message: 'Error generating recipe',
            error: error.response?.data?.error?.message || error.message
        });
    }
};

module.exports = {
    generateRecipeResponse,
    generateCompleteRecipe
};
