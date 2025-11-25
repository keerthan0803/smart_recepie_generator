const axios = require('axios');
const Customer = require('../models/customer');

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// Debug: Log the model configuration on startup
console.log('🤖 OpenAI Configuration:', { MODEL: OPENAI_MODEL });

/**
 * Call OpenAI ChatGPT API with exponential backoff retry logic
 * Handles rate limiting (429) gracefully
 */
const callOpenAIWithRetry = async (messages, apiKey, maxRetries = 3) => {
    const url = 'https://api.openai.com/v1/chat/completions';
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            console.log(`📤 Attempt ${attempt + 1}/${maxRetries + 1}: Calling OpenAI with model: ${OPENAI_MODEL}`);
            
            const response = await axios.post(
                url,
                {
                    model: OPENAI_MODEL,
                    messages: messages,
                    temperature: 0.7,
                    max_tokens: 1000,
                    top_p: 0.95
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    timeout: 20000
                }
            );
            
            console.log(`✅ Success with ${OPENAI_MODEL}`);
            return response;
            
        } catch (error) {
            const status = error.response?.status;
            const isRateLimited = status === 429;
            
            if (isRateLimited && attempt < maxRetries) {
                // Exponential backoff: 200ms, 400ms, 800ms
                const backoffMs = 200 * Math.pow(2, attempt);
                console.warn(`⏱️ Rate limited (429). Retrying in ${backoffMs}ms...`);
                
                // Sleep before retry
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                continue;
            }
            
            // If not rate limited or out of retries, throw error
            if (attempt === maxRetries) {
                if (isRateLimited) {
                    throw new Error('Rate limit retries exhausted. Check OpenAI API quota/billing.');
                }
                throw error;
            }
        }
    }
};

// Fallback response when API is unavailable
const getFallbackResponse = (userInput) => {
    const input = userInput?.toLowerCase() || '';
    
    if (input.includes('pasta') || input.includes('spaghetti')) {
        return "🍝 Great choice! Do you prefer classic tomato sauce, creamy alfredo, or pesto? Any dietary restrictions?";
    } else if (input.includes('chicken') || input.includes('meat')) {
        return "🍗 Chicken is versatile! Grilled, baked, curry, or stir-fry? What skill level are you?";
    } else if (input.includes('vegetarian') || input.includes('vegan')) {
        return "🥗 Excellent! What vegetables or proteins do you have - beans, tofu, lentils?";
    } else if (input.includes('quick') || input.includes('fast')) {
        return "⚡ Need something fast! 30-minute recipes: what main ingredients do you have?";
    } else if (input.includes('dessert') || input.includes('sweet')) {
        return "🍰 Sweet treat! Interested in cakes, cookies, puddings, or ice cream?";
    } else if (input.includes('vegan')) {
        return "🌱 Vegan recipes! What base ingredients do you have available?";
    } else {
        return `🤔 I need more details!\n\n• What ingredients do you have?\n• Any dietary preferences?\n• How much time available?\n\nThen I can create a perfect recipe! 🍳`;
    }
};

// Generate AI response using OpenAI ChatGPT API
const generateRecipeResponse = async (req, res) => {
    try {
        const { message, conversationHistory, customerId, userProfile } = req.body;
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

        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: 'OpenAI API key not configured'
            });
        }

        // Build system message for ChatGPT
        let systemMessage = `You are a professional chef and recipe assistant. Your role is to:
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

Keep responses concise but informative. Use emojis occasionally to make the conversation engaging.`;

        // Add user profile information to system message if available
        if (userProfile) {
            systemMessage += `\n\n=== USER PROFILE ===`;
            
            if (userProfile.skillLevel) {
                systemMessage += `\nCooking Skill Level: ${userProfile.skillLevel}`;
            }
            
            if (userProfile.dietaryPreferences && userProfile.dietaryPreferences.length > 0) {
                systemMessage += `\nDietary Preferences: ${userProfile.dietaryPreferences.join(', ')}`;
            }
            
            if (userProfile.allergies && userProfile.allergies.length > 0) {
                systemMessage += `\nAllergies to AVOID: ${userProfile.allergies.join(', ')}`;
            }
            
            if (userProfile.favoriteIngredients && userProfile.favoriteIngredients.length > 0) {
                systemMessage += `\nFavorite Ingredients: ${userProfile.favoriteIngredients.join(', ')}`;
            }
            
            if (userProfile.dislikedIngredients && userProfile.dislikedIngredients.length > 0) {
                systemMessage += `\nIngredients to Avoid: ${userProfile.dislikedIngredients.join(', ')}`;
            }
        }

        // Build messages array for ChatGPT
        const messages = [{ role: 'system', content: systemMessage }];

        // Add conversation history if provided
        if (conversationHistory && Array.isArray(conversationHistory)) {
            conversationHistory.forEach(msg => {
                const role = msg.sender === 'user' ? 'user' : 'assistant';
                messages.push({ role, content: msg.message });
            });
        }

        // Add current user message
        messages.push({ role: 'user', content: message });

        // Call OpenAI API with retry logic
        let response;
        try {
            response = await callOpenAIWithRetry(messages, apiKey, 2);
        } catch (error) {
            console.error(`❌ OpenAI API failed:`, error.message);
            throw error;
        }

        const aiMessage = response.data.choices[0].message.content;

        res.status(200).json({
            success: true,
            message: aiMessage,
            tokensUsed: response.data.usage?.total_tokens || 0,
            credits: updated.credits
        });

    } catch (error) {
        console.error('OpenAI API Error:', error.response?.data || error.message);

        // Refund credit on retriable errors
        try {
            const status = error.response?.status;
            if (status === 429 || status === 500 || error.code === 'ECONNABORTED') {
                await Customer.updateOne({ _id: req.body.customerId }, { $inc: { credits: 1 } });
                console.log('💳 Credit refunded due to temporary error');
            }
        } catch (refundErr) {
            console.warn('Credit refund failed:', refundErr.message);
        }

        const statusCode = error.response?.status === 429 ? 429 : 500;
        res.status(statusCode).json({
            success: false,
            message: statusCode === 429 
                ? 'Service temporarily busy. Please try again in a moment.' 
                : 'Error generating AI response',
            error: error.response?.data?.error?.message || error.message,
            fallbackResponse: getFallbackResponse(req.body.message)
        });
    }
};

// Generate a complete recipe from ingredients
const generateCompleteRecipe = async (req, res) => {
    try {
        const { ingredients, preferences, skillLevel, cookingTime } = req.body;
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: 'OpenAI API key not configured'
            });
        }

        const messages = [
            {
                role: 'system',
                content: 'You are a professional chef creating detailed recipes.'
            },
            {
                role: 'user',
                content: `Create a detailed recipe using these ingredients: ${ingredients.join(', ')}.

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

Format the response in a clear, easy-to-read structure.`
            }
        ];

        const response = await callOpenAIWithRetry(messages, apiKey, 2);

        const recipe = response.data.choices[0].message.content;

        res.status(200).json({
            success: true,
            recipe: recipe,
            tokensUsed: response.data.usage?.total_tokens || 0
        });

    } catch (error) {
        console.error('OpenAI Recipe Generation Error:', error.response?.data || error.message);
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
