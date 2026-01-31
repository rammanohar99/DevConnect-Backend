import { Request, Response, NextFunction } from 'express'
import { notificationService } from './notification.service'
import logger from '../../shared/utils/logger'

/**
 * Get user's notifications with optional filters
 * GET /api/v1/notifications
 */
export const getNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const { isRead, type } = req.query

    const filters: any = {}

    if (isRead !== undefined) {
      filters.isRead = isRead === 'true'
    }

    if (type) {
      filters.type = type
    }

    const notifications = await notificationService.getUserNotifications(userId, filters)

    logger.info('Notifications retrieved', {
      userId,
      count: notifications.length,
      filters,
    })

    res.status(200).json({
      status: 'success',
      data: {
        notifications,
      },
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Mark a notification as read
 * PATCH /api/v1/notifications/:id/read
 */
export const markNotificationAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const { id } = req.params

    const notification = await notificationService.markAsRead(id, userId)

    logger.info('Notification marked as read', {
      userId,
      notificationId: id,
    })

    res.status(200).json({
      status: 'success',
      data: {
        notification,
      },
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Mark all notifications as read for the user
 * POST /api/v1/notifications/read-all
 */
export const markAllNotificationsAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId

    const result = await notificationService.markAllAsRead(userId)

    logger.info('All notifications marked as read', {
      userId,
      modifiedCount: result.modifiedCount,
    })

    res.status(200).json({
      status: 'success',
      data: {
        modifiedCount: result.modifiedCount,
      },
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get unread notification count
 * GET /api/v1/notifications/unread-count
 */
export const getUnreadCount = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId

    const count = await notificationService.getUnreadCount(userId)

    res.status(200).json({
      status: 'success',
      data: {
        count,
      },
    })
  } catch (error) {
    next(error)
  }
}
