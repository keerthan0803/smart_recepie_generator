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

module.exports = router;
