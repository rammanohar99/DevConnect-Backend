import { getRedisPublisher, getRedisSubscriber } from '../config/redis'
import { getIO } from './socket'
import logger from '../shared/utils/logger'

interface PubSubMessage {
  event: string
  data: any
  room?: string
  userId?: string
  excludeSocketId?: string
}

interface ChannelHandler {
  channel: string
  handler: (message: PubSubMessage) => void
}

const activeChannels = new Map<string, ChannelHandler>()

/**
 * Publish a message to a Redis channel for cross-instance communication
 */
export const publishMessage = async (channel: string, message: PubSubMessage): Promise<void> => {
  try {
    const publisher = getRedisPublisher()
    const messageString = JSON.stringify(message)

    await publisher.publish(channel, messageString)

    logger.debug('Published message to Redis channel', {
      channel,
      event: message.event,
      room: message.room,
      userId: message.userId,
    })
  } catch (error) {
    logger.error('Failed to publish message to Redis', {
      channel,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Subscribe to a Redis channel and handle incoming messages
 */
export const subscribeToChannel = async (
  channel: string,
  handler: (message: PubSubMessage) => void
): Promise<void> => {
  try {
    const subscriber = getRedisSubscriber()

    // Store the handler for this channel
    activeChannels.set(channel, { channel, handler })

    // Subscribe to the channel
    await subscriber.subscribe(channel, (messageString) => {
      try {
        const message: PubSubMessage = JSON.parse(messageString)

        logger.debug('Received message from Redis channel', {
          channel,
          event: message.event,
          room: message.room,
          userId: message.userId,
        })

        // Call the handler
        handler(message)
      } catch (error) {
        logger.error('Failed to parse Redis pub/sub message', {
          channel,
          error: error instanceof Error ? error.message : 'Unknown error',
          messageString,
        })
      }
    })

    logger.info('Subscribed to Redis channel', { channel })
  } catch (error) {
    logger.error('Failed to subscribe to Redis channel', {
      channel,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Unsubscribe from a Redis channel
 */
export const unsubscribeFromChannel = async (channel: string): Promise<void> => {
  try {
    const subscriber = getRedisSubscriber()

    await subscriber.unsubscribe(channel)
    activeChannels.delete(channel)

    logger.info('Unsubscribed from Redis channel', { channel })
  } catch (error) {
    logger.error('Failed to unsubscribe from Redis channel', {
      channel,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Broadcast a Socket.IO event to all connected clients across all server instances
 */
export const broadcastEvent = async (event: string, data: any): Promise<void> => {
  try {
    const message: PubSubMessage = {
      event,
      data,
    }

    await publishMessage('socket:broadcast', message)
  } catch (error) {
    logger.error('Failed to broadcast event', {
      event,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Emit a Socket.IO event to a specific room across all server instances
 */
export const emitToRoomAcrossInstances = async (
  room: string,
  event: string,
  data: any
): Promise<void> => {
  try {
    const message: PubSubMessage = {
      event,
      data,
      room,
    }

    await publishMessage('socket:room', message)
  } catch (error) {
    logger.error('Failed to emit to room across instances', {
      room,
      event,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Emit a Socket.IO event to a specific user across all server instances
 */
export const emitToUserAcrossInstances = async (
  userId: string,
  event: string,
  data: any
): Promise<void> => {
  try {
    const message: PubSubMessage = {
      event,
      data,
      userId,
    }

    await publishMessage('socket:user', message)
  } catch (error) {
    logger.error('Failed to emit to user across instances', {
      userId,
      event,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Initialize pub/sub subscriptions for Socket.IO events
 */
export const initializePubSub = async (): Promise<void> => {
  try {
    // Subscribe to broadcast channel
    await subscribeToChannel('socket:broadcast', (message) => {
      const io = getIO()
      io.emit(message.event, message.data)
    })

    // Subscribe to room channel
    await subscribeToChannel('socket:room', (message) => {
      if (!message.room) {
        logger.warn('Received room message without room identifier')
        return
      }

      const io = getIO()
      io.to(message.room).emit(message.event, message.data)
    })

    // Subscribe to user channel
    await subscribeToChannel('socket:user', (message) => {
      if (!message.userId) {
        logger.warn('Received user message without userId')
        return
      }

      const io = getIO()
      io.to(`user:${message.userId}`).emit(message.event, message.data)
    })

    logger.info('✅ Redis pub/sub initialized for Socket.IO')
  } catch (error) {
    logger.error('Failed to initialize pub/sub', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Cleanup pub/sub subscriptions
 */
export const cleanupPubSub = async (): Promise<void> => {
  try {
    const channels = Array.from(activeChannels.keys())

    for (const channel of channels) {
      await unsubscribeFromChannel(channel)
    }

    logger.info('Cleaned up all pub/sub subscriptions')
  } catch (error) {
    logger.error('Failed to cleanup pub/sub', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Get list of active channels
 */
export const getActiveChannels = (): string[] => {
  return Array.from(activeChannels.keys())
}
