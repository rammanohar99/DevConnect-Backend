import { z } from 'zod'

/**
 * Validation schema for getting notifications with filters
 */
export const getNotificationsSchema = z.object({
  query: z.object({
    isRead: z
      .string()
      .optional()
      .transform((val) => {
        if (val === undefined) return undefined
        return val === 'true'
      }),
    type: z.enum(['like', 'comment', 'mention', 'issue_assigned', 'message']).optional(),
  }),
})

/**
 * Validation schema for marking notification as read
 */
export const markAsReadSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Notification ID is required'),
  }),
})

/**
 * Validation schema for marking all notifications as read
 */
export const markAllAsReadSchema = z.object({
  body: z.object({}).optional(),
})
