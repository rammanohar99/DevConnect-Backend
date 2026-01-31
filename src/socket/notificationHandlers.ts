import { Socket } from 'socket.io'
import logger from '../shared/utils/logger'

interface AuthenticatedSocket extends Socket {
  userId?: string
  email?: string
  role?: string
}

/**
 * Register notification-related socket event handlers
 */
export const registerNotificationHandlers = (socket: AuthenticatedSocket): void => {
  if (!socket.userId) {
    logger.warn('Cannot register notification handlers: socket not authenticated')
    return
  }

  // Join user's notification room
  const notificationRoom = `notifications:${socket.userId}`
  socket.join(notificationRoom)

  logger.debug('User joined notification room', {
    socketId: socket.id,
    userId: socket.userId,
    room: notificationRoom,
  })

  // Handle notification acknowledgment (optional)
  socket.on('notification:ack', (data: { notificationId: string }) => {
    logger.debug('Notification acknowledged', {
      userId: socket.userId,
      notificationId: data.notificationId,
    })
  })

  // Handle request for notification count
  socket.on('notification:request_count', async () => {
    try {
      const { notificationService } = await import('../modules/notifications/notification.service')
      const count = await notificationService.getUnreadCount(socket.userId!)

      socket.emit('notification:count', { count })

      logger.debug('Sent notification count to user', {
        userId: socket.userId,
        count,
      })
    } catch (error) {
      logger.error('Error fetching notification count', {
        userId: socket.userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      socket.emit('notification:error', {
        message: 'Failed to fetch notification count',
      })
    }
  })
}

/**
 * Emit a notification to a specific user via Socket.IO
 * This is called from the notification service when a notification is created
 */
export const emitNotificationToUser = (userId: string, notification: any): void => {
  const { getIO } = require('./socket')

  try {
    const io = getIO()
    const notificationRoom = `notifications:${userId}`

    io.to(notificationRoom).emit('notification:new', notification)

    logger.debug('Notification emitted to user', {
      userId,
      notificationId: notification._id,
      type: notification.type,
      room: notificationRoom,
    })
  } catch (error) {
    logger.error('Failed to emit notification to user', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
