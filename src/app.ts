import express, { Application } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import compression from 'compression'
import { config } from './config/env'
import { checkDatabaseConnection } from './config/database'
import { checkRedisConnection } from './config/redis'
import { requestLogger } from './shared/middleware/logger.middleware'
import { sanitizeInput } from './shared/middleware/sanitize.middleware'
import { errorHandler, notFoundHandler } from './shared/middleware/error.middleware'
import logger from './shared/utils/logger'

const app: Application = express()

// Security middleware
app.use(helmet())

// CORS configuration
app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  })
)

// Body parsing middleware
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Input sanitization middleware
app.use(sanitizeInput)

// Compression middleware
app.use(compression())

// Request logging middleware
app.use(requestLogger)

// Health check endpoints
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

app.get('/health/ready', (_req, res) => {
  const dbConnected = checkDatabaseConnection()
  const redisConnected = checkRedisConnection()

  if (dbConnected && redisConnected) {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        redis: 'connected',
      },
    })
  } else {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      services: {
        database: dbConnected ? 'connected' : 'disconnected',
        redis: redisConnected ? 'connected' : 'disconnected',
      },
    })
  }
})

app.get('/health/live', (_req, res) => {
  res.status(200).json({
    status: 'live',
    timestamp: new Date().toISOString(),
  })
})

// API routes
import authRoutes from './modules/auth/auth.routes'
import userRoutes from './modules/users/user.routes'
import postRoutes from './modules/posts/post.routes'
import issueRoutes from './modules/issues/issue.routes'
import chatRoutes from './modules/chat/chat.routes'
import notificationRoutes from './modules/notifications/notification.routes'
import adminRoutes from './modules/admin/admin.routes'

app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/users', userRoutes)
app.use('/api/v1/posts', postRoutes)
app.use('/api/v1/issues', issueRoutes)
app.use('/api/v1/chats', chatRoutes)
app.use('/api/v1/notifications', notificationRoutes)
app.use('/api/v1/admin', adminRoutes)

// 404 handler
app.use(notFoundHandler)

// Error handling middleware (must be last)
app.use(errorHandler)

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server')
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server')
  process.exit(0)
})

export default app
