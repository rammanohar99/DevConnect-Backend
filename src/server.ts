import { createServer } from 'http'
import app from './app'
import { config } from './config/env'
import { connectDatabase, disconnectDatabase } from './config/database'
import { connectRedis, disconnectRedis } from './config/redis'
import { initializeSocketIO } from './socket/socket'
import { initializePubSub, cleanupPubSub } from './socket/pubsub'
import logger from './shared/utils/logger'
import { validateEnv } from './config/validateEnv'

const PORT = config.port

const startServer = async () => {
  try {
    // Validate environment variables before starting
    logger.info('Validating environment configuration...')
    validateEnv()
    logger.info('✅ Environment validation passed')

    // Connect to MongoDB
    await connectDatabase()

    // Connect to Redis
    await connectRedis()

    // Create HTTP server
    const httpServer = createServer(app)

    // Initialize Socket.IO
    initializeSocketIO(httpServer)

    // Initialize Redis pub/sub for Socket.IO
    await initializePubSub()

    // Start HTTP server
    const server = httpServer.listen(PORT, () => {
      logger.info(`🚀 Server running in ${config.env} mode on port ${PORT}`)
      logger.info(`📍 Health check: http://localhost:${PORT}/health`)
      logger.info(`📍 API base URL: http://localhost:${PORT}/api/v1`)
      logger.info(`🔌 WebSocket server ready`)
    })

    // Graceful shutdown
    const gracefulShutdown = async () => {
      logger.info('Shutting down gracefully...')

      server.close(async () => {
        logger.info('HTTP server closed')

        await cleanupPubSub()
        await disconnectDatabase()
        await disconnectRedis()

        process.exit(0)
      })

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout')
        process.exit(1)
      }, 10000)
    }

    process.on('SIGTERM', gracefulShutdown)
    process.on('SIGINT', gracefulShutdown)

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: Error) => {
      logger.error('Unhandled Rejection:', reason)
      gracefulShutdown()
    })

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception:', error)
      gracefulShutdown()
    })

    return server
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

export default startServer
