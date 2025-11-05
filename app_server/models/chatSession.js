const mongoose = require('mongoose');

// Chat Session Schema
const chatSessionSchema = new mongoose.Schema({
    // Customer reference
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true,
        index: true
    },
    
    // Session Information
    sessionId: {
        type: String,
        required: true
    },
    
    title: {
        type: String,
        default: 'New Chat'
    },
    
    // Keywords and Food Names for search and categorization
    keywords: [{
        type: String,
        lowercase: true,
        trim: true
    }],
    
    foodNames: [{
        type: String,
        lowercase: true,
        trim: true
    }],
    
    // Messages in this session
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
    }],
    
    // Session metadata
    messageCount: {
        type: Number,
        default: 0
    },
    
    isActive: {
        type: Boolean,
        default: true
    },
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    lastMessageAt: {
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

// Indexes for better query performance
chatSessionSchema.index({ customerId: 1, createdAt: -1 });
chatSessionSchema.index({ customerId: 1, lastMessageAt: -1 });
chatSessionSchema.index({ sessionId: 1 }, { unique: true });
chatSessionSchema.index({ keywords: 1 });
chatSessionSchema.index({ foodNames: 1 });

// Virtual for getting the last message preview
chatSessionSchema.virtual('preview').get(function() {
    if (this.messages && this.messages.length > 0) {
        const lastMessage = this.messages[this.messages.length - 1];
        return lastMessage.message.substring(0, 100);
    }
    return '';
});

// Method to add a message to the session
chatSessionSchema.methods.addMessage = function(message, sender, recipeGenerated = false, recipeId = null) {
    this.messages.push({
        message,
        sender,
        recipeGenerated,
        recipeId,
        timestamp: new Date()
    });
    
    this.messageCount = this.messages.length;
    this.lastMessageAt = new Date();
    
    // Extract keywords and food names from user messages
    if (sender === 'user') {
        this.extractKeywordsAndFoodNames(message);
    }
    
    return this.save();
};

// Method to extract keywords and food names from messages
chatSessionSchema.methods.extractKeywordsAndFoodNames = function(message) {
    const commonFoods = [
        'chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'shrimp', 'pasta', 'rice', 
        'noodles', 'bread', 'pizza', 'burger', 'sandwich', 'salad', 'soup', 'curry', 
        'stew', 'steak', 'vegetable', 'potato', 'tomato', 'onion', 'garlic', 'cheese',
        'egg', 'milk', 'butter', 'oil', 'dessert', 'cake', 'cookie', 'pie', 'pancake',
        'bacon', 'sausage', 'turkey', 'lamb', 'lobster', 'crab', 'squid', 'tofu',
        'beans', 'lentils', 'quinoa', 'mushroom', 'broccoli', 'carrot', 'spinach',
        'avocado', 'cucumber', 'pepper', 'chili', 'ginger', 'cilantro', 'basil'
    ];
    
    const keywords = [
        'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'paleo', 'halal',
        'kosher', 'quick', 'easy', 'healthy', 'spicy', 'sweet', 'savory', 'sour',
        'baked', 'grilled', 'fried', 'steamed', 'boiled', 'roasted', 'raw',
        'breakfast', 'lunch', 'dinner', 'snack', 'appetizer', 'main course', 'side dish'
    ];
    
    const messageLower = message.toLowerCase();
    
    // Extract food names
    commonFoods.forEach(food => {
        if (messageLower.includes(food) && !this.foodNames.includes(food)) {
            this.foodNames.push(food);
        }
    });
    
    // Extract keywords
    keywords.forEach(keyword => {
        if (messageLower.includes(keyword) && !this.keywords.includes(keyword)) {
            this.keywords.push(keyword);
        }
    });
    
    // Auto-generate title from first few food items or keywords
    if (this.title === 'New Chat' && (this.foodNames.length > 0 || this.keywords.length > 0)) {
        const titleParts = [...this.foodNames.slice(0, 2), ...this.keywords.slice(0, 1)];
        this.title = titleParts.slice(0, 3).map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ') + ' Recipe';
    }
};

// Method to get messages with pagination
chatSessionSchema.methods.getMessages = function(limit = 100, skip = 0) {
    return this.messages
        .sort((a, b) => a.timestamp - b.timestamp)
        .slice(skip, skip + limit);
};

// Static method to find sessions by customer
chatSessionSchema.statics.findByCustomer = function(customerId, limit = 50) {
    return this.find({ customerId })
        .sort({ lastMessageAt: -1 })
        .limit(limit);
};

// Static method to search sessions by keywords or food names
chatSessionSchema.statics.searchSessions = function(customerId, searchTerm) {
    const searchRegex = new RegExp(searchTerm, 'i');
    return this.find({
        customerId,
        $or: [
            { title: searchRegex },
            { keywords: searchRegex },
            { foodNames: searchRegex }
        ]
    }).sort({ lastMessageAt: -1 });
};

// Pre-save middleware to update timestamps and message count
chatSessionSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    this.messageCount = this.messages.length;
    next();
});

// Create model
const ChatSession = mongoose.model('ChatSession', chatSessionSchema);

module.exports = ChatSession;
