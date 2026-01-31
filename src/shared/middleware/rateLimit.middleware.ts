import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import { getRedisClient } from '../../config/redis'
import logger from '../utils/logger'

/**
 * Rate limiting configuration for different endpoint types
 */

// General API rate limiter - 100 requests per 15 minutes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  store: new RedisStore({
    // @ts-expect-error - RedisStore types are not fully compatible with redis v4
    client: getRedisClient(),
    prefix: 'rl:api:',
  }),
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    })
    res.status(429).json({
      status: 'error',
      statusCode: 429,
      message: 'Too many requests from this IP, please try again later.',
    })
  },
})

// Strict rate limiter for authentication endpoints - 5 requests per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all requests
  store: new RedisStore({
    // @ts-expect-error - RedisStore types are not fully compatible with redis v4
    client: getRedisClient(),
    prefix: 'rl:auth:',
  }),
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    })
    res.status(429).json({
      status: 'error',
      statusCode: 429,
      message: 'Too many authentication attempts, please try again later.',
    })
  },
})

// Upload rate limiter - 10 uploads per hour
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 uploads per hour
  message: 'Too many upload requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - RedisStore types are not fully compatible with redis v4
    client: getRedisClient(),
    prefix: 'rl:upload:',
  }),
  handler: (req, res) => {
    logger.warn('Upload rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    })
    res.status(429).json({
      status: 'error',
      statusCode: 429,
      message: 'Too many upload requests, please try again later.',
    })
  },
})

// Strict rate limiter for password reset - 3 requests per hour
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 requests per hour
  message: 'Too many password reset attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - RedisStore types are not fully compatible with redis v4
    client: getRedisClient(),
    prefix: 'rl:password:',
  }),
  handler: (req, res) => {
    logger.warn('Password reset rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    })
    res.status(429).json({
      status: 'error',
      statusCode: 429,
      message: 'Too many password reset attempts, please try again later.',
    })
  },
})

// Create account rate limiter - 3 registrations per hour per IP
export const createAccountLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 registrations per hour
  message: 'Too many accounts created from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    // @ts-expect-error - RedisStore types are not fully compatible with redis v4
    client: getRedisClient(),
    prefix: 'rl:register:',
  }),
  handler: (req, res) => {
    logger.warn('Account creation rate limit exceeded', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    })
    res.status(429).json({
      status: 'error',
      statusCode: 429,
      message: 'Too many accounts created from this IP, please try again later.',
    })
  },
})
