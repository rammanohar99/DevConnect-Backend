import { Request, Response, NextFunction } from 'express'
import * as adminService from './admin.service'
import { GetUserListDTO, UpdateUserRoleDTO, HideContentDTO } from './admin.types'
import logger from '../../shared/utils/logger'

/**
 * Get paginated list of users
 * GET /api/v1/admin/users
 */
export const getUserList = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const filters: GetUserListDTO = {
      page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
      role: req.query.role as 'user' | 'moderator' | 'admin' | undefined,
      search: req.query.search as string | undefined,
    }

    const result = await adminService.getUserList(filters)

    res.status(200).json({
      status: 'success',
      data: result,
    })
  } catch (error) {
    logger.error('Error in getUserList controller', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    next(error)
  }
}

/**
 * Update user role
 * PATCH /api/v1/admin/users/:id/role
 */
export const updateUserRole = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.params.id
    const adminId = req.user!.userId
    const data: UpdateUserRoleDTO = req.body

    const user = await adminService.updateUserRole(adminId, userId, data)

    res.status(200).json({
      status: 'success',
      data: { user },
      message: 'User role updated successfully',
    })
  } catch (error) {
    logger.error('Error in updateUserRole controller', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.params.id,
    })
    next(error)
  }
}

/**
 * Delete/hide a post
 * DELETE /api/v1/admin/posts/:id
 */
export const deletePost = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const postId = req.params.id
    const adminId = req.user!.userId
    const reason = req.body.reason

    const data: HideContentDTO = {
      contentType: 'post',
      contentId: postId,
      reason,
    }

    await adminService.hideContent(adminId, data)

    res.status(200).json({
      status: 'success',
      message: 'Post hidden successfully',
    })
  } catch (error) {
    logger.error('Error in deletePost controller', {
      error: error instanceof Error ? error.message : 'Unknown error',
      postId: req.params.id,
    })
    next(error)
  }
}

/**
 * Delete a comment
 * DELETE /api/v1/admin/comments/:id
 */
export const deleteComment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const commentId = req.params.id
    const adminId = req.user!.userId
    const reason = req.body.reason

    const data: HideContentDTO = {
      contentType: 'comment',
      contentId: commentId,
      reason,
    }

    await adminService.hideContent(adminId, data)

    res.status(200).json({
      status: 'success',
      message: 'Comment deleted successfully',
    })
  } catch (error) {
    logger.error('Error in deleteComment controller', {
      error: error instanceof Error ? error.message : 'Unknown error',
      commentId: req.params.id,
    })
    next(error)
  }
}

/**
 * Get system metrics
 * GET /api/v1/admin/metrics
 */
export const getSystemMetrics = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const metrics = await adminService.getSystemMetrics()

    res.status(200).json({
      status: 'success',
      data: { metrics },
    })
  } catch (error) {
    logger.error('Error in getSystemMetrics controller', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    next(error)
  }
}

/**
 * Get audit logs
 * GET /api/v1/admin/audit-logs
 */
export const getAuditLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50

    const result = await adminService.getAuditLogs(page, limit)

    res.status(200).json({
      status: 'success',
      data: result,
    })
  } catch (error) {
    logger.error('Error in getAuditLogs controller', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    next(error)
  }
}
