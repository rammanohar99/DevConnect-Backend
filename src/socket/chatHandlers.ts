import { Socket } from 'socket.io'
import { sendMessage } from '../modules/chat/chat.service'
import { emitToRoomAcrossInstances } from './pubsub'
import { setUserOnline, setUserOffline } from '../modules/presence/presence.service'
import logger from '../shared/utils/logger'

interface AuthenticatedSocket extends Socket {
  userId?: string
  email?: string
  role?: string
}

interface SendMessagePayload {
  chatId: string
  content: string

}

interface JoinChatPayload {
  chatId: string
}

interface TypingPayload {
  chatId: string
}

/**
 * Register chat-related Socket.IO event handlers
 */
export const registerChatHandlers = (socket: AuthenticatedSocket): void => {
  // Handle send_message event
  socket.on('send_message', async (payload: SendMessagePayload, callback) => {
    try {
      if (!socket.userId) {
        logger.warn('Unauthenticated socket attempted to send message', {
          socketId: socket.id,
        })
        if (callback) {
          callback({ error: 'Authentication required' })
        }
        return
      }

      const { chatId, content } = payload

      // Validate payload
      if (!chatId || !content || content.trim().length === 0) {
        logger.warn('Invalid send_message payload', {
          socketId: socket.id,
          userId: socket.userId,
          chatId,
        })
        if (callback) {
          callback({ error: 'Invalid message data' })
        }
        return
      }

      // Send message via service (persists to database)
      const message = await sendMessage(socket.userId, {
        chatId,
        content,
      })

      logger.info('Message sent via socket', {
        socketId: socket.id,
        userId: socket.userId,
        chatId,
        messageId: message._id,
      })

      // Broadcast message to all participants in the chat room
      // Use getIO to emit directly to the room on this instance
      const { getIO } = require('./socket')
      const io = getIO()
      io.to(`chat:${chatId}`).emit('new_message', message)

      logger.debug('Message broadcast to room', {
        room: `chat:${chatId}`,
        messageId: message._id,
      })

      // Send acknowledgment to sender
      if (callback) {
        callback({ success: true, message })
      }
    } catch (error) {
      logger.error('Failed to handle send_message event', {
        socketId: socket.id,
        userId: socket.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      if (callback) {
        callback({
          error: error instanceof Error ? error.message : 'Failed to send message',
        })
      }
    }
  })

  // Handle join_chat event
  socket.on('join_chat', async (payload: JoinChatPayload, callback) => {
    try {
      if (!socket.userId) {
        logger.warn('Unauthenticated socket attempted to join chat', {
          socketId: socket.id,
        })
        if (callback) {
          callback({ error: 'Authentication required' })
        }
        return
      }

      const { chatId } = payload

      if (!chatId) {
        logger.warn('Invalid join_chat payload', {
          socketId: socket.id,
          userId: socket.userId,
        })
        if (callback) {
          callback({ error: 'Chat ID required' })
        }
        return
      }

      // Join the Socket.IO room for this chat
      socket.join(`chat:${chatId}`)

      logger.info('User joined chat room', {
        socketId: socket.id,
        userId: socket.userId,
        chatId,
        room: `chat:${chatId}`,
        roomsCount: socket.rooms.size,
        rooms: Array.from(socket.rooms),
      })

      // Send acknowledgment
      if (callback) {
        callback({ success: true, chatId })
      }
    } catch (error) {
      logger.error('Failed to handle join_chat event', {
        socketId: socket.id,
        userId: socket.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      if (callback) {
        callback({
          error: error instanceof Error ? error.message : 'Failed to join chat',
        })
      }
    }
  })

  // Handle leave_chat event
  socket.on('leave_chat', async (payload: JoinChatPayload, callback) => {
    try {
      if (!socket.userId) {
        logger.warn('Unauthenticated socket attempted to leave chat', {
          socketId: socket.id,
        })
        if (callback) {
          callback({ error: 'Authentication required' })
        }
        return
      }

      const { chatId } = payload

      if (!chatId) {
        logger.warn('Invalid leave_chat payload', {
          socketId: socket.id,
          userId: socket.userId,
        })
        if (callback) {
          callback({ error: 'Chat ID required' })
        }
        return
      }

      // Leave the Socket.IO room for this chat
      socket.leave(`chat:${chatId}`)

      logger.info('User left chat room', {
        socketId: socket.id,
        userId: socket.userId,
        chatId,
        room: `chat:${chatId}`,
      })

      // Send acknowledgment
      if (callback) {
        callback({ success: true, chatId })
      }
    } catch (error) {
      logger.error('Failed to handle leave_chat event', {
        socketId: socket.id,
        userId: socket.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      if (callback) {
        callback({
          error: error instanceof Error ? error.message : 'Failed to leave chat',
        })
      }
    }
  })

  // Handle typing event
  socket.on('typing', async (payload: TypingPayload) => {
    try {
      if (!socket.userId) {
        logger.warn('Unauthenticated socket attempted to send typing indicator', {
          socketId: socket.id,
        })
        return
      }

      const { chatId } = payload

      if (!chatId) {
        logger.warn('Invalid typing payload', {
          socketId: socket.id,
          userId: socket.userId,
        })
        return
      }

      // Broadcast typing indicator to other participants in the chat
      await emitToRoomAcrossInstances(`chat:${chatId}`, 'user_typing', {
        chatId,
        userId: socket.userId,
        email: socket.email,
      })

      logger.debug('Typing indicator sent', {
        socketId: socket.id,
        userId: socket.userId,
        chatId,
      })
    } catch (error) {
      logger.error('Failed to handle typing event', {
        socketId: socket.id,
        userId: socket.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // Handle stop_typing event
  socket.on('stop_typing', async (payload: TypingPayload) => {
    try {
      if (!socket.userId) {
        logger.warn('Unauthenticated socket attempted to send stop typing indicator', {
          socketId: socket.id,
        })
        return
      }

      const { chatId } = payload

      if (!chatId) {
        logger.warn('Invalid stop_typing payload', {
          socketId: socket.id,
          userId: socket.userId,
        })
        return
      }

      // Broadcast stop typing indicator to other participants in the chat
      await emitToRoomAcrossInstances(`chat:${chatId}`, 'user_stop_typing', {
        chatId,
        userId: socket.userId,
        email: socket.email,
      })

      logger.debug('Stop typing indicator sent', {
        socketId: socket.id,
        userId: socket.userId,
        chatId,
      })
    } catch (error) {
      logger.error('Failed to handle stop_typing event', {
        socketId: socket.id,
        userId: socket.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  // Handle user_online event (explicit online status update)
  socket.on('user_online', async (callback) => {
    try {
      if (!socket.userId) {
        logger.warn('Unauthenticated socket attempted to set online status', {
          socketId: socket.id,
        })
        if (callback) {
          callback({ error: 'Authentication required' })
        }
        return
      }

      // Set user online (already done in connection handler, but allow explicit updates)
      await setUserOnline(socket.userId, socket.id)

      logger.debug('User explicitly set online', {
        socketId: socket.id,
        userId: socket.userId,
      })

      if (callback) {
        callback({ success: true, status: 'online' })
      }
    } catch (error) {
      logger.error('Failed to handle user_online event', {
        socketId: socket.id,
        userId: socket.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      if (callback) {
        callback({
          error: error instanceof Error ? error.message : 'Failed to set online status',
        })
      }
    }
  })

  // Handle user_offline event (explicit offline status update)
  socket.on('user_offline', async (callback) => {
    try {
      if (!socket.userId) {
        logger.warn('Unauthenticated socket attempted to set offline status', {
          socketId: socket.id,
        })
        if (callback) {
          callback({ error: 'Authentication required' })
        }
        return
      }

      // Set user offline
      await setUserOffline(socket.userId)

      logger.debug('User explicitly set offline', {
        socketId: socket.id,
        userId: socket.userId,
      })

      if (callback) {
        callback({ success: true, status: 'offline' })
      }
    } catch (error) {
      logger.error('Failed to handle user_offline event', {
        socketId: socket.id,
        userId: socket.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      if (callback) {
        callback({
          error: error instanceof Error ? error.message : 'Failed to set offline status',
        })
      }
    }
  })

  logger.debug('Chat handlers registered for socket', {
    socketId: socket.id,
    userId: socket.userId,
  })
}
