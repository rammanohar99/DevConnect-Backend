import { Server as HTTPServer } from 'http'
import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { config } from '../config/env'
import {
  setUserOnline,
  setUserOffline,
  refreshUserPresence,
} from '../modules/presence/presence.service'
import { registerChatHandlers } from './chatHandlers'
import { registerNotificationHandlers } from './notificationHandlers'
import logger from '../shared/utils/logger'

interface JWTPayload {
  userId: string
  email: string
  role: string
}

interface AuthenticatedSocket extends Socket {
  userId?: string
  email?: string
  role?: string
}

let io: Server | null = null

export const initializeSocketIO = (httpServer: HTTPServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  })

  // JWT authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1]

      if (!token) {
        logger.warn('Socket connection attempt without token', {
          socketId: socket.id,
          ip: socket.handshake.address,
        })
        return next(new Error('Authentication required'))
      }

      // Verify JWT token
      const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload

      // Attach user info to socket
      socket.userId = decoded.userId
      socket.email = decoded.email
      socket.role = decoded.role

      logger.info('Socket authenticated', {
        socketId: socket.id,
        userId: decoded.userId,
        email: decoded.email,
      })

      next()
    } catch (error) {
      logger.error('Socket authentication failed', {
        socketId: socket.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      next(new Error('Authentication failed'))
    }
  })

  // Connection handler
  io.on('connection', async (socket: AuthenticatedSocket) => {
    logger.info('Client connected', {
      socketId: socket.id,
      userId: socket.userId,
      email: socket.email,
    })

    // Join user to their personal room for targeted messages
    if (socket.userId) {
      socket.join(`user:${socket.userId}`)
      logger.debug('User joined personal room', {
        socketId: socket.id,
        userId: socket.userId,
        room: `user:${socket.userId}`,
      })

      // Mark user as online
      try {
        await setUserOnline(socket.userId, socket.id)
      } catch (error) {
        logger.error('Failed to set user online', {
          userId: socket.userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Register chat event handlers
    registerChatHandlers(socket)

    // Register notification event handlers
    registerNotificationHandlers(socket)

    // Handle presence heartbeat
    socket.on('presence:heartbeat', async () => {
      if (socket.userId) {
        try {
          await refreshUserPresence(socket.userId)
        } catch (error) {
          logger.error('Failed to refresh user presence', {
            userId: socket.userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    })

    // Handle disconnection
    socket.on('disconnect', async (reason) => {
      logger.info('Client disconnected', {
        socketId: socket.id,
        userId: socket.userId,
        reason,
      })

      // Mark user as offline
      if (socket.userId) {
        try {
          await setUserOffline(socket.userId)
        } catch (error) {
          logger.error('Failed to set user offline', {
            userId: socket.userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    })

    // Handle errors
    socket.on('error', (error) => {
      logger.error('Socket error', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message,
      })
    })

    // Handle connection errors
    socket.on('connect_error', (error) => {
      logger.error('Socket connection error', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message,
      })
    })
  })

  logger.info('✅ Socket.IO server initialized')

  return io
}

export const getIO = (): Server => {
  if (!io) {
    throw new Error('Socket.IO not initialized. Call initializeSocketIO first.')
  }
  return io
}

export const emitToUser = (userId: string, event: string, data: any): void => {
  if (!io) {
    logger.error('Cannot emit to user: Socket.IO not initialized')
    return
  }

  io.to(`user:${userId}`).emit(event, data)
  logger.debug('Emitted event to user', {
    userId,
    event,
    room: `user:${userId}`,
  })
}

export const emitToRoom = (room: string, event: string, data: any): void => {
  if (!io) {
    logger.error('Cannot emit to room: Socket.IO not initialized')
    return
  }

  io.to(room).emit(event, data)
  logger.debug('Emitted event to room', {
    room,
    event,
  })
}

export const broadcastToAll = (event: string, data: any): void => {
  if (!io) {
    logger.error('Cannot broadcast: Socket.IO not initialized')
    return
  }

  io.emit(event, data)
  logger.debug('Broadcast event to all clients', {
    event,
  })
}
