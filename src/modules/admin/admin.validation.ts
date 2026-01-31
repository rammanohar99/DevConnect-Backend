import { z } from 'zod'

/**
 * Schema for getting user list with filters
 */
export const getUserListSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20)),
    role: z.enum(['user', 'moderator', 'admin']).optional(),
    search: z.string().optional(),
  }),
})

/**
 * Schema for updating user role
 */
export const updateUserRoleSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'User ID is required'),
  }),
  body: z.object({
    role: z.enum(['user', 'moderator', 'admin'], {
      required_error: 'Role is required',
      invalid_type_error: 'Role must be user, moderator, or admin',
    }),
  }),
})

/**
 * Schema for deleting/hiding posts
 */
export const deletePostSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Post ID is required'),
  }),
  body: z.object({
    reason: z.string().optional(),
  }),
})

/**
 * Schema for deleting comments
 */
export const deleteCommentSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Comment ID is required'),
  }),
  body: z.object({
    reason: z.string().optional(),
  }),
})

/**
 * Schema for getting system metrics
 */
export const getSystemMetricsSchema = z.object({
  query: z.object({}).optional(),
})

/**
 * Schema for getting audit logs
 */
export const getAuditLogsSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 50)),
  }),
})
