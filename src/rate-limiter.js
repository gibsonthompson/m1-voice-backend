// ====================================================================
// RATE LIMITING MIDDLEWARE - API Protection
// ====================================================================
// Protects your API from abuse, DDoS attacks, and excessive requests.
// Install with: npm install express-rate-limit
// ====================================================================

const rateLimit = require('express-rate-limit');

// ============================================
// GENERAL API RATE LIMITER
// ============================================
// Protects all /api/* routes from excessive requests
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window per IP
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  // Skip rate limiting for whitelisted IPs (optional)
  skip: (req) => {
    const whitelist = (process.env.RATE_LIMIT_WHITELIST || '').split(',');
    return whitelist.includes(req.ip);
  }
});

// ============================================
// AUTH/LOGIN RATE LIMITER
// ============================================
// Stricter limits for authentication endpoints to prevent brute force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 login attempts per 15 minutes
  message: {
    error: 'Too many login attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful logins
});

// ============================================
// WEBHOOK RATE LIMITER
// ============================================
// Higher limits for legitimate webhook traffic
const webhookLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // 1000 requests per hour per IP
  message: {
    error: 'Webhook rate limit exceeded.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================
// SIGNUP RATE LIMITER
// ============================================
// Prevent spam signups
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Max 3 signups per hour per IP
  message: {
    error: 'Too many signup attempts, please try again later.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================
// DASHBOARD RATE LIMITER
// ============================================
// Moderate limits for dashboard API calls
const dashboardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per 15 minutes (plenty for normal use)
  message: {
    error: 'Dashboard rate limit exceeded.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================
// AGGRESSIVE RATE LIMITER (For sensitive endpoints)
// ============================================
// Very strict - use for password resets, email verification, etc.
const aggressiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 requests per hour
  message: {
    error: 'Rate limit exceeded for this action.',
    retryAfter: '1 hour'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================
// EXPORTS
// ============================================
module.exports = {
  apiLimiter,
  authLimiter,
  webhookLimiter,
  signupLimiter,
  dashboardLimiter,
  aggressiveLimiter
};