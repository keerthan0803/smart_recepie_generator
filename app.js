var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mongoose = require('mongoose');
var helmet = require('helmet');
var cors = require('cors');
var rateLimit = require('express-rate-limit');
var mongoSanitize = require('express-mongo-sanitize');
var hpp = require('hpp');
require('dotenv').config();

var indexRouter = require('./app_server/routes/index');
var usersRouter = require('./app_server/routes/users');
var customerRouter = require('./app_server/routes/customer');
var geminiRouter = require('./app_server/routes/gemini');
var billingRouter = require('./app_server/routes/billing');

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

// ============================================
// SECURITY MIDDLEWARE - CRITICAL FOR PRODUCTION
// ============================================

// 1. Helmet - Sets various HTTP headers for security
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// 2. CORS - Configure allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'https://smart-recepie-generator-1nwr.onrender.com',
  process.env.BASE_URL
].filter(Boolean);

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now, restrict later if needed
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 3. Rate Limiting - Prevent brute force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Stricter rate limit for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 attempts per 15 minutes
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});
app.use('/api/customer/login', authLimiter);
app.use('/api/customer/signup', authLimiter);

// 4. Data Sanitization against NoSQL injection
app.use(mongoSanitize());

// 5. Prevent HTTP Parameter Pollution
app.use(hpp());

// 6. Force HTTPS in production
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(301, 'https://' + req.headers.host + req.url);
  }
  next();
});

// 7. Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.removeHeader('X-Powered-By');
  next();
});

// ============================================
// VIEW ENGINE & BASIC SETUP
// ============================================

// view engine setup
app.set('views', path.join(__dirname, 'app_server/views'));
app.set('view engine', 'jade');

// Trust proxy (required for Render and other cloud platforms)
app.set('trust proxy', 1);

// Stripe webhook requires the raw body for signature verification; mount BEFORE JSON parser
app.post('/api/billing/webhooks/stripe', express.raw({ type: 'application/json' }), require('./app_server/controllers/billingController').stripeWebhook);

// Body parser with size limits
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
