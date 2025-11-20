const mongoose = require('mongoose');

// Customer Schema
const customerSchema = new mongoose.Schema({
    // Personal Information
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    
    // OAuth Information
    googleId: {
        type: String,
        default: null
    },
    
    // Profile Information
    phoneNumber: {
        type: String,
        default: null,
        trim: true
    },
    age: {
        type: Number,
        default: null,
        min: 13,
        max: 120
    },
    skillLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced', 'professional'],
        default: 'beginner'
    },
    profileImage: {
        type: String,
        default: null
    },
    profileCompleted: {
        type: Boolean,
        default: false
    },
    
    // Preferences
    dietaryPreferences: [{
        type: String,
        enum: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'paleo', 'halal', 'kosher']
    }],
    allergies: [{
        type: String
    }],
    favoriteIngredients: [{
        type: String
    }],
    dislikedIngredients: [{
        type: String
    }],
    
    // Chat Sessions with History
    chatSessions: [{
        sessionId: {
            type: String,
            required: true
        },
        title: {
            type: String,
            default: 'New Chat'
        },
        keywords: [{
            type: String
        }],
        foodNames: [{
            type: String
        }],
        createdAt: {
            type: Date,
            default: Date.now
        },
        lastMessageAt: {
            type: Date,
            default: Date.now
        },
        messages: [{
            message: {
                type: String,
                required: true
            },
            sender: {
                type: String,
                enum: ['user', 'ai'],
                required: true
            },
            timestamp: {
                type: Date,
                default: Date.now
            },
            recipeGenerated: {
                type: Boolean,
                default: false
            },
            recipeId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Recipe',
                default: null
            }
        }]
    }],
    
    // Legacy Chat History (kept for backward compatibility)
    chatHistory: [{
        message: {
            type: String,
            required: true
        },
        sender: {
            type: String,
            enum: ['user', 'ai'],
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        recipeGenerated: {
            type: Boolean,
            default: false
        },
        recipeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Recipe',
            default: null
        }
    }],
    
    // Activity Tracking
    savedRecipes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recipe'
    }],
    favoriteRecipes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recipe'
    }],
    recipeHistory: [{
        recipeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Recipe'
        },
        viewedAt: {
            type: Date,
            default: Date.now
        },
        cooked: {
            type: Boolean,
            default: false
        },
        rating: {
            type: Number,
            min: 1,
            max: 5,
            default: null
        }
    }],
    
    // Account Information
    accountStatus: {
        type: String,
        enum: ['active', 'inactive', 'suspended'],
        default: 'active'
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Email Verification fields
customerSchema.add({
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: {
        type: String,
        default: null
    },
    emailVerificationExpires: {
        type: Date,
        default: null
    },
    // Password Reset fields
    passwordResetToken: {
        type: String,
        default: null
    },
    passwordResetExpires: {
        type: Date,
        default: null
    },
    // Credits / Billing
    credits: {
        type: Number,
        default: 10,
        min: 0
    },
    // Pending Transactions (for payment tracking)
    pendingTransactions: [{
        transactionId: {
            type: String,
            required: true
        },
        credits: {
            type: Number,
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        gateway: {
            type: String,
            enum: ['stripe', 'phonepe'],
            required: true
        },
        status: {
            type: String,
            enum: ['PENDING', 'COMPLETED', 'FAILED', 'PAYMENT_PENDING', 'PAYMENT_SUCCESS'],
            default: 'PENDING'
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        completedAt: {
            type: Date,
            default: null
        },
        phonePeTransactionId: {
            type: String,
            default: null
        }
    }]
});

// Methods for credits
customerSchema.methods.addCredits = function(amount) {
    const add = Math.max(0, Number(amount) || 0);
    this.credits = (this.credits || 0) + add;
    return this.save();
};

// Try to deduct credits atomically using updateOne if needed at controller level
customerSchema.methods.hasCredits = function(count = 1) {
    return (this.credits || 0) >= count;
};

// Index for faster queries - unique email index
customerSchema.index({ email: 1 }, { unique: true });
customerSchema.index({ createdAt: -1 });

// Virtual for full name
customerSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`;
});

// Method to create a new chat session
customerSchema.methods.createChatSession = function() {
    const sessionId = new mongoose.Types.ObjectId().toString();
    this.chatSessions.push({
        sessionId,
        title: 'New Chat',
        keywords: [],
        foodNames: [],
        messages: [],
        createdAt: new Date(),
        lastMessageAt: new Date()
    });
    return this.save().then(() => sessionId);
};

// Method to add a message to a specific chat session
customerSchema.methods.addMessageToSession = function(sessionId, message, sender, recipeGenerated = false, recipeId = null) {
    const session = this.chatSessions.find(s => s.sessionId === sessionId);
    if (!session) {
        throw new Error('Chat session not found');
    }
    
    session.messages.push({
        message,
        sender,
        recipeGenerated,
        recipeId,
        timestamp: new Date()
    });
    
    session.lastMessageAt = new Date();
    
    // Extract keywords and food names from user messages
    if (sender === 'user') {
        this.extractKeywordsAndFoodNames(sessionId, message);
    }
    
    return this.save();
};

// Method to extract keywords and food names from messages
customerSchema.methods.extractKeywordsAndFoodNames = function(sessionId, message) {
    const session = this.chatSessions.find(s => s.sessionId === sessionId);
    if (!session) return;
    
    const commonFoods = [
        'chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'shrimp', 'pasta', 'rice', 
        'noodles', 'bread', 'pizza', 'burger', 'sandwich', 'salad', 'soup', 'curry', 
        'stew', 'steak', 'vegetable', 'potato', 'tomato', 'onion', 'garlic', 'cheese',
        'egg', 'milk', 'butter', 'oil', 'dessert', 'cake', 'cookie', 'pie', 'pancake'
    ];
    
    const keywords = [
        'vegetarian', 'vegan', 'gluten-free', 'quick', 'easy', 'healthy', 'spicy',
        'sweet', 'savory', 'baked', 'grilled', 'fried', 'steamed', 'boiled'
    ];
    
    const messageLower = message.toLowerCase();
    
    // Extract food names
    commonFoods.forEach(food => {
        if (messageLower.includes(food) && !session.foodNames.includes(food)) {
            session.foodNames.push(food);
        }
    });
    
    // Extract keywords
    keywords.forEach(keyword => {
        if (messageLower.includes(keyword) && !session.keywords.includes(keyword)) {
            session.keywords.push(keyword);
        }
    });
    
    // Auto-generate title from first few food items or keywords
    if (session.title === 'New Chat' && (session.foodNames.length > 0 || session.keywords.length > 0)) {
        const titleParts = [...session.foodNames.slice(0, 2), ...session.keywords.slice(0, 1)];
        session.title = titleParts.slice(0, 3).map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ') + ' Recipe';
    }
};

// Method to get all chat sessions (summary)
customerSchema.methods.getChatSessions = function() {
    return this.chatSessions
        .sort((a, b) => b.lastMessageAt - a.lastMessageAt)
        .map(session => ({
            sessionId: session.sessionId,
            title: session.title,
            keywords: session.keywords,
            foodNames: session.foodNames,
            messageCount: session.messages.length,
            createdAt: session.createdAt,
            lastMessageAt: session.lastMessageAt,
            preview: session.messages.length > 0 ? session.messages[session.messages.length - 1].message : ''
        }));
};

// Method to get messages from a specific session
customerSchema.methods.getSessionMessages = function(sessionId, limit = 100) {
    const session = this.chatSessions.find(s => s.sessionId === sessionId);
    if (!session) {
        throw new Error('Chat session not found');
    }
    
    return session.messages
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(-limit);
};

// Method to update session title
customerSchema.methods.updateSessionTitle = function(sessionId, title) {
    const session = this.chatSessions.find(s => s.sessionId === sessionId);
    if (!session) {
        throw new Error('Chat session not found');
    }
    
    session.title = title;
    return this.save();
};

// Method to delete a chat session
customerSchema.methods.deleteChatSession = function(sessionId) {
    this.chatSessions = this.chatSessions.filter(s => s.sessionId !== sessionId);
    return this.save();
};

// Legacy method to add a chat message (backward compatibility)
customerSchema.methods.addChatMessage = function(message, sender, recipeGenerated = false, recipeId = null) {
    this.chatHistory.push({
        message,
        sender,
        recipeGenerated,
        recipeId,
        timestamp: new Date()
    });
    return this.save();
};

// Legacy method to get recent chat history (backward compatibility)
customerSchema.methods.getRecentChats = function(limit = 10) {
    return this.chatHistory
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
};

// Method to save a recipe
customerSchema.methods.saveRecipe = function(recipeId) {
    if (!this.savedRecipes.includes(recipeId)) {
        this.savedRecipes.push(recipeId);
        return this.save();
    }
    return Promise.resolve(this);
};

// Method to favorite a recipe
customerSchema.methods.favoriteRecipe = function(recipeId) {
    if (!this.favoriteRecipes.includes(recipeId)) {
        this.favoriteRecipes.push(recipeId);
        return this.save();
    }
    return Promise.resolve(this);
};

// Method to add to recipe history
customerSchema.methods.addToRecipeHistory = function(recipeId, cooked = false, rating = null) {
    this.recipeHistory.push({
        recipeId,
        viewedAt: new Date(),
        cooked,
        rating
    });
    return this.save();
};

// Method to update last login
customerSchema.methods.updateLastLogin = function() {
    this.lastLogin = new Date();
    return this.save();
};

// Static method to find customer by email
customerSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

// Pre-save middleware to update the updatedAt field
customerSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
