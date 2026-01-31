import { createClient, RedisClientType } from 'redis'
import { config } from './env'
import logger from '../shared/utils/logger'

let redisClient: RedisClientType | null = null
let redisPublisher: RedisClientType | null = null
let redisSubscriber: RedisClientType | null = null

export const connectRedis = async (): Promise<void> => {
  try {
    // Main Redis client for caching
    redisClient = createClient({
      url: config.redis.url,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 attempts')
            return new Error('Redis reconnection failed')
          }
          return retries * 100
        },
      },
    })

    redisClient.on('error', (error) => {
      logger.error('Redis client error:', error)
    })

    redisClient.on('connect', () => {
      logger.info('Redis client connecting...')
    })

    redisClient.on('ready', () => {
      logger.info('✅ Redis client ready')
    })

    redisClient.on('reconnecting', () => {
      logger.warn('Redis client reconnecting...')
    })

    await redisClient.connect()

    // Publisher client for pub/sub
    redisPublisher = redisClient.duplicate()
    await redisPublisher.connect()
    logger.info('✅ Redis publisher ready')

    // Subscriber client for pub/sub
    redisSubscriber = redisClient.duplicate()
    await redisSubscriber.connect()
    logger.info('✅ Redis subscriber ready')
  } catch (error) {
    logger.error('❌ Redis connection failed:', error)
    process.exit(1)
  }
}

export const disconnectRedis = async (): Promise<void> => {
  try {
    if (redisClient) {
      await redisClient.quit()
      logger.info('Redis client disconnected')
    }
    if (redisPublisher) {
      await redisPublisher.quit()
      logger.info('Redis publisher disconnected')
    }
    if (redisSubscriber) {
      await redisSubscriber.quit()
      logger.info('Redis subscriber disconnected')
    }
  } catch (error) {
    logger.error('Error disconnecting Redis:', error)
  }
}

export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    throw new Error('Redis client not initialized')
  }
  return redisClient
}

export const getRedisPublisher = (): RedisClientType => {
  if (!redisPublisher) {
    throw new Error('Redis publisher not initialized')
  }
  return redisPublisher
}

export const getRedisSubscriber = (): RedisClientType => {
  if (!redisSubscriber) {
    throw new Error('Redis subscriber not initialized')
  }
  return redisSubscriber
}

export const checkRedisConnection = (): boolean => {
  return redisClient?.isOpen ?? false
}
