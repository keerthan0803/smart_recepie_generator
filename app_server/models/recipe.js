const mongoose = require('mongoose');

// Recipe Schema
const recipeSchema = new mongoose.Schema({
    // Basic Recipe Information
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    cuisine: {
        type: String,
        required: true
    },
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        required: true
    },
    
    // Time Information
    prepTime: {
        type: Number, // in minutes
        required: true
    },
    cookTime: {
        type: Number, // in minutes
        required: true
    },
    totalTime: {
        type: Number, // in minutes
        required: true
    },
    
    // Ingredients
    ingredients: [{
        name: {
            type: String,
            required: true
        },
        quantity: {
            type: String,
            required: true
        },
        unit: {
            type: String,
            required: true
        }
    }],
    
    // Instructions
    instructions: [{
        step: {
            type: Number,
            required: true
        },
        description: {
            type: String,
            required: true
        }
    }],
    
    // Nutritional Information
    nutrition: {
        calories: Number,
        protein: String,
        carbs: String,
        fat: String,
        fiber: String
    },
    
    // Serving Information
    servings: {
        type: Number,
        required: true,
        default: 1
    },
    
    // Tags and Categories
    tags: [{
        type: String
    }],
    dietaryInfo: [{
        type: String,
        enum: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'paleo', 'halal', 'kosher']
    }],
    
    // Recipe Source
    generatedBy: {
        type: String,
        enum: ['ai', 'user', 'admin'],
        default: 'ai'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        default: null
    },
    
    // Engagement Metrics
    views: {
        type: Number,
        default: 0
    },
    likes: {
        type: Number,
        default: 0
    },
    saves: {
        type: Number,
        default: 0
    },
    
    // Recipe Image
    imageUrl: {
        type: String,
        default: null
    },
    
    // Status
    isPublic: {
        type: Boolean,
        default: true
    },
    
    // Timestamps
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

// Indexes for faster queries
recipeSchema.index({ title: 1 });
recipeSchema.index({ cuisine: 1 });
recipeSchema.index({ difficulty: 1 });
recipeSchema.index({ createdAt: -1 });

// Virtual for total time calculation
recipeSchema.virtual('calculatedTotalTime').get(function() {
    return this.prepTime + this.cookTime;
});

// Method to increment views
recipeSchema.methods.incrementViews = function() {
    this.views += 1;
    return this.save();
};

// Method to increment likes
recipeSchema.methods.incrementLikes = function() {
    this.likes += 1;
    return this.save();
};

// Method to increment saves
recipeSchema.methods.incrementSaves = function() {
    this.saves += 1;
    return this.save();
};

// Static method to find recipes by difficulty
recipeSchema.statics.findByDifficulty = function(difficulty) {
    return this.find({ difficulty });
};

// Static method to find recipes by cuisine
recipeSchema.statics.findByCuisine = function(cuisine) {
    return this.find({ cuisine });
};

// Static method to find recipes by dietary info
recipeSchema.statics.findByDietaryInfo = function(dietaryInfo) {
    return this.find({ dietaryInfo: { $in: [dietaryInfo] } });
};

const Recipe = mongoose.model('Recipe', recipeSchema);

module.exports = Recipe;
