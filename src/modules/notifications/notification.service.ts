import mongoose from 'mongoose'
import { Notification, INotification } from './notification.model'
import { CreateNotificationDTO, NotificationFilters } from './notification.types'
import { NotFoundError, ValidationError } from '../../shared/types/errors'
import logger from '../../shared/utils/logger'

export class NotificationService {
  /**
   * Create a new notification
   * This is typically called asynchronously from other services
   */
  async createNotification(data: CreateNotificationDTO): Promise<INotification> {
    try {
      // Validate recipient and actor IDs
      if (!mongoose.Types.ObjectId.isValid(data.recipientId)) {
        throw new ValidationError('Invalid recipient ID', [
          { field: 'recipientId', message: 'Invalid recipient ID format' },
        ])
      }

      if (!mongoose.Types.ObjectId.isValid(data.actorId)) {
        throw new ValidationError('Invalid actor ID', [
          { field: 'actorId', message: 'Invalid actor ID format' },
        ])
      }

      // Don't create notification if actor is the same as recipient
      if (data.recipientId === data.actorId) {
        logger.debug('Skipping notification creation: actor is recipient', {
          recipientId: data.recipientId,
          actorId: data.actorId,
        })
        return null as any
      }

      // Validate resource ID if provided
      if (data.resource?.id && !mongoose.Types.ObjectId.isValid(data.resource.id)) {
        throw new ValidationError('Invalid resource ID', [
          { field: 'resource.id', message: 'Invalid resource ID format' },
        ])
      }

      const notification = new Notification({
        recipient: data.recipientId,
        type: data.type,
        actor: data.actorId,
        message: data.message,
        resource: data.resource
          ? {
              type: data.resource.type,
              id: data.resource.id,
            }
          : undefined,
        isRead: false,
      })

      await notification.save()

      // Populate actor information
      await notification.populate('actor', 'username profile.name profile.avatar')

      logger.info('Notification created', {
        notificationId: notification._id,
        recipientId: data.recipientId,
        type: data.type,
      })

      // Emit real-time notification to user via Socket.IO
      this.emitNotificationToUser(data.recipientId, notification)

      return notification
    } catch (error) {
      logger.error('Error creating notification:', error)
      throw error
    }
  }

  /**
   * Get user's notifications with optional filters
   */
  async getUserNotifications(
    userId: string,
    filters: NotificationFilters = {}
  ): Promise<INotification[]> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ValidationError('Invalid user ID', [
        { field: 'userId', message: 'Invalid user ID format' },
      ])
    }

    const query: any = {
      recipient: userId,
    }

    // Apply filters
    if (filters.isRead !== undefined) {
      query.isRead = filters.isRead
    }

    if (filters.type) {
      query.type = filters.type
    }

    const notifications = await Notification.find(query)
      .populate('actor', 'username profile.name profile.avatar')
      .sort({ createdAt: -1 })
      .limit(50) // Limit to most recent 50 notifications
      .lean()
      .exec()

    return notifications as unknown as INotification[]
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<INotification> {
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      throw new ValidationError('Invalid notification ID', [
        { field: 'notificationId', message: 'Invalid notification ID format' },
      ])
    }

    const notification = await Notification.findById(notificationId)

    if (!notification) {
      throw new NotFoundError('Notification')
    }

    // Verify the notification belongs to the user
    if (notification.recipient.toString() !== userId) {
      throw new ValidationError('Unauthorized access to notification', [
        { field: 'notificationId', message: 'This notification does not belong to you' },
      ])
    }

    // Update read status
    notification.isRead = true
    await notification.save()

    // Populate actor information
    await notification.populate('actor', 'username profile.name profile.avatar')

    logger.debug('Notification marked as read', {
      notificationId,
      userId,
    })

    return notification
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ValidationError('Invalid user ID', [
        { field: 'userId', message: 'Invalid user ID format' },
      ])
    }

    const result = await Notification.updateMany(
      { recipient: userId, isRead: false },
      { $set: { isRead: true } }
    )

    logger.info('All notifications marked as read', {
      userId,
      modifiedCount: result.modifiedCount,
    })

    return { modifiedCount: result.modifiedCount }
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new ValidationError('Invalid user ID', [
        { field: 'userId', message: 'Invalid user ID format' },
      ])
    }

    const count = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    })

    return count
  }

  /**
   * Delete old read notifications (cleanup utility)
   * Can be called periodically to keep database clean
   */
  async deleteOldReadNotifications(daysOld: number = 30): Promise<{ deletedCount: number }> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const result = await Notification.deleteMany({
      isRead: true,
      createdAt: { $lt: cutoffDate },
    })

    logger.info('Old read notifications deleted', {
      deletedCount: result.deletedCount,
      daysOld,
    })

    return { deletedCount: result.deletedCount || 0 }
  }

  /**
   * Emit notification to user via Socket.IO
   * Private helper method to send real-time notifications
   */
  private emitNotificationToUser(userId: string, notification: INotification): void {
    try {
      // Dynamically import to avoid circular dependencies
      const { emitNotificationToUser } = require('../../socket/notificationHandlers')
      emitNotificationToUser(userId, notification)
    } catch (error) {
      logger.error('Failed to emit notification via Socket.IO', {
        userId,
        notificationId: notification._id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      // Don't throw - Socket.IO emission failures shouldn't break notification creation
    }
  }
}

export const notificationService = new NotificationService()
