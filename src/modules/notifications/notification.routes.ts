import { Router } from 'express'
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadCount,
} from './notification.controller'
import { authenticate } from '../../shared/middleware/auth.middleware'
import { validate } from '../../shared/middleware/validation.middleware'
import {
  getNotificationsSchema,
  markAsReadSchema,
  markAllAsReadSchema,
} from './notification.validation'

const router = Router()

// All notification routes require authentication
router.use(authenticate)

/**
 * GET /api/v1/notifications
 * Get user's notifications with optional filters
 */
router.get('/', validate(getNotificationsSchema), getNotifications)

/**
 * GET /api/v1/notifications/unread-count
 * Get unread notification count
 */
router.get('/unread-count', getUnreadCount)

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a specific notification as read
 */
router.patch('/:id/read', validate(markAsReadSchema), markNotificationAsRead)

/**
 * POST /api/v1/notifications/read-all
 * Mark all notifications as read
 */
router.post('/read-all', validate(markAllAsReadSchema), markAllNotificationsAsRead)

export default router
