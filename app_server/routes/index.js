var express = require('express');
var router = express.Router();

/* GET React app pages */
router.get('/', function(req, res, next) {
  res.render('react_app', { title: 'Smart Recipe Generator' });
});

router.get('/chat', function(req, res, next) {
  res.render('react_app', { title: 'AI Chat - Smart Recipe Generator' });
});

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('react_app', { title: 'Smart Recipe Generator' });
});

/* GET chatbot page (full screen). */
router.get('/chatbot', function(req, res, next) {
  res.render('chatbot', { title: 'Smart Recipe AI Chat' });
});

/* GET sign up page. */
router.get('/signup', function(req, res, next) {
  res.render('sign_up', { title: 'Sign Up - Smart Recipe Generator' });
});

/* GET sign in page. */
router.get('/signin', function(req, res, next) {
  res.render('sign_in', { title: 'Sign In - Smart Recipe Generator' });
});

/* GET buy credits page. */
router.get('/buy-credits', function(req, res, next) {
  res.render('buy_credits', { title: 'Buy Credits - Smart Recipe Generator' });
});

/* GET reset password page. */
router.get('/reset-password', function(req, res, next) {
  res.render('reset_password', { title: 'Reset Password - Smart Recipe Generator' });
});

/* GET profile page. */
router.get('/profile', async function(req, res, next) {
  try {
    // Try to get customerId from query, session, or cookies
    const customerId = req.query.customerId || req.session?.customerId || req.cookies?.customerId;
    
    if (!customerId) {
      // If no customerId, render profile page and let client-side JS handle it
      return res.render('profile', { title: 'My Profile - Smart Recipe Generator' });
    }

    const Customer = require('../models/customer');
    const customer = await Customer.findById(customerId);
    
    if (!customer) {
      return res.redirect('/signin');
    }

    // Check if personal info is complete (phoneNumber, age, skillLevel)
    const isProfileComplete = customer.phoneNumber && customer.age !== null && customer.skillLevel;
    
    if (!isProfileComplete) {
      // Redirect to complete profile form if personal info is missing
      return res.redirect(`/complete-profile?customerId=${customerId}`);
    }

    res.render('profile', { title: 'My Profile - Smart Recipe Generator' });
  } catch (error) {
    console.error('Error loading profile:', error);
    res.render('profile', { title: 'My Profile - Smart Recipe Generator' });
  }
});

/* GET complete profile page. */
router.get('/complete-profile', function(req, res, next) {
  const customerId = req.query.customerId;
  res.render('complete_profile', { 
    title: 'Complete Your Profile - Smart Recipe Generator',
    customerId: customerId
  });
});

module.exports = router;
