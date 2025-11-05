const express = require('express');
const router = express.Router();
const geminiController = require('../controllers/geminiController');

// Generate AI chat response
router.post('/chat', geminiController.generateRecipeResponse);

// Generate complete recipe from ingredients
router.post('/recipe', geminiController.generateCompleteRecipe);

module.exports = router;
