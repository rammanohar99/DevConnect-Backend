import { Router } from 'express'
import * as adminController from './admin.controller'
import { authenticate } from '../../shared/middleware/auth.middleware'
import { requireAdmin, requireModerator } from '../../shared/middleware/admin.middleware'
import { validate } from '../../shared/middleware/validation.middleware'
import {
  getUserListSchema,
  updateUserRoleSchema,
  deletePostSchema,
  deleteCommentSchema,
  getSystemMetricsSchema,
  getAuditLogsSchema,
} from './admin.validation'

const router = Router()

// All admin routes require authentication
router.use(authenticate)

/**
 * GET /api/v1/admin/users
 * Get paginated list of users with optional filters
 * Accessible by: Admin only
 */
router.get('/users', requireAdmin, validate(getUserListSchema), adminController.getUserList)

/**
 * PATCH /api/v1/admin/users/:id/role
 * Update user role
 * Accessible by: Admin only
 */
router.patch(
  '/users/:id/role',
  requireAdmin,
  validate(updateUserRoleSchema),
  adminController.updateUserRole
)

/**
 * DELETE /api/v1/admin/posts/:id
 * Hide/archive a post
 * Accessible by: Admin and Moderator
 */
router.delete(
  '/posts/:id',
  requireModerator,
  validate(deletePostSchema),
  adminController.deletePost
)

/**
 * DELETE /api/v1/admin/comments/:id
 * Delete a comment
 * Accessible by: Admin and Moderator
 */
router.delete(
  '/comments/:id',
  requireModerator,
  validate(deleteCommentSchema),
  adminController.deleteComment
)

/**
 * GET /api/v1/admin/metrics
 * Get system metrics (user count, post count, active users, etc.)
 * Accessible by: Admin and Moderator
 */
router.get(
  '/metrics',
  requireModerator,
  validate(getSystemMetricsSchema),
  adminController.getSystemMetrics
)

/**
 * GET /api/v1/admin/audit-logs
 * Get audit logs with pagination
 * Accessible by: Admin only
 */
router.get(
  '/audit-logs',
  requireAdmin,
  validate(getAuditLogsSchema),
  adminController.getAuditLogs
)

export default router
