var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mongoose = require('mongoose');
require('dotenv').config();

var indexRouter = require('./app_server/routes/index');
var usersRouter = require('./app_server/routes/users');
var customerRouter = require('./app_server/routes/customer');
var geminiRouter = require('./app_server/routes/gemini');
var billingRouter = require('./app_server/routes/billing');
var expressRaw = require('express');

// MongoDB connection
const mongoURI = process.env.MONGODB_URI || process.env.MONGODB_LOCAL || 'mongodb://localhost:27017/smart-recipe-generator';

mongoose.connect(mongoURI)
  .then(() => {
    console.log('Connected to MongoDB database: smart-recipe-generator');
    console.log('Database:', mongoURI.includes('mongodb+srv') ? 'MongoDB Atlas (Cloud)' : 'Local MongoDB');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    // Try fallback to local MongoDB if Atlas fails
    if (mongoURI.includes('mongodb+srv')) {
      console.log('Attempting to connect to local MongoDB...');
      const localURI = process.env.MONGODB_LOCAL || 'mongodb://localhost:27017/smart-recipe-generator';
      mongoose.connect(localURI)
        .then(() => {
          console.log('Connected to local MongoDB database');
        })
        .catch((localErr) => {
          console.error('Local MongoDB connection also failed:', localErr.message);
          console.error('Please ensure MongoDB is running or check your Atlas credentials');
        });
    }
  });

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', function() {
  console.log('MongoDB connection established successfully');
});

var app = express();

// Security Headers
app.use((req, res, next) => {
  // Force HTTPS in production
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect('https://' + req.headers.host + req.url);
  }
  
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self';"
  );
  
  next();
});

// view engine setup
app.set('views', path.join(__dirname, 'app_server/views'));
app.set('view engine', 'jade');

// Trust proxy (required for Render)
app.set('trust proxy', 1);

// Stripe webhook requires the raw body for signature verification; mount BEFORE JSON parser
app.post('/api/billing/webhooks/stripe', expressRaw.raw({ type: 'application/json' }), require('./app_server/controllers/billingController').stripeWebhook);

app.use(logger('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/customer', customerRouter);
app.use('/api/gemini', geminiRouter);
app.use('/api/billing', billingRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error', { title: 'Error' });
});

module.exports = app;
