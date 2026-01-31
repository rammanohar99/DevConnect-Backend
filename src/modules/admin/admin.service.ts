import { User } from '../users/user.model'
import { Post } from '../posts/post.model'
import { Comment } from '../posts/comment.model'
import { Issue } from '../issues/issue.model'
import { AuditLog } from './auditLog.model'
import { getOnlineUsers } from '../presence/presence.service'
import {
  GetUserListDTO,
  UpdateUserRoleDTO,
  HideContentDTO,
  SystemMetrics,
  PaginatedUsers,
} from './admin.types'
import { NotFoundError, ValidationError } from '../../shared/types/errors'
import logger from '../../shared/utils/logger'
import mongoose from 'mongoose'

/**
 * Get paginated list of users with optional filters
 */
export const getUserList = async (filters: GetUserListDTO): Promise<PaginatedUsers> => {
  try {
    const { page = 1, limit = 20, role, search } = filters

    // Build query
    const query: any = {}

    if (role) {
      query.role = role
    }

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { 'profile.name': { $regex: search, $options: 'i' } },
      ]
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Execute query
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -refreshTokens')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ])

    const totalPages = Math.ceil(total / limit)

    logger.info('Retrieved user list', {
      page,
      limit,
      total,
      filters: { role, search },
    })

    return {
      users,
      total,
      page,
      limit,
      totalPages,
    }
  } catch (error) {
    logger.error('Failed to get user list', {
      error: error instanceof Error ? error.message : 'Unknown error',
      filters,
    })
    throw error
  }
}

/**
 * Update user role (admin only)
 */
export const updateUserRole = async (
  adminId: string,
  userId: string,
  data: UpdateUserRoleDTO
): Promise<any> => {
  try {
    const { role } = data

    // Validate role
    if (!['user', 'moderator', 'admin'].includes(role)) {
      throw new ValidationError('Invalid role', [
        { field: 'role', message: 'Role must be user, moderator, or admin' },
      ])
    }

    // Find user
    const user = await User.findById(userId).select('-password -refreshTokens')

    if (!user) {
      throw new NotFoundError('User')
    }

    // Store old role for audit log
    const oldRole = user.role

    // Update role
    user.role = role
    await user.save()

    // Create audit log entry
    await auditLog(adminId, 'update_user_role', 'user', userId, {
      oldRole,
      newRole: role,
    })

    logger.info('User role updated', {
      adminId,
      userId,
      oldRole,
      newRole: role,
    })

    return user
  } catch (error) {
    logger.error('Failed to update user role', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId,
      userId,
      data,
    })
    throw error
  }
}

/**
 * Hide or delete content (posts or comments)
 */
export const hideContent = async (adminId: string, data: HideContentDTO): Promise<void> => {
  try {
    const { contentType, contentId, reason } = data

    if (contentType === 'post') {
      // Find and update post status to 'archived' (hidden)
      const post = await Post.findById(contentId)

      if (!post) {
        throw new NotFoundError('Post')
      }

      const oldStatus = post.status
      post.status = 'archived'
      await post.save()

      // Create audit log entry
      await auditLog(adminId, 'hide_post', 'post', contentId, {
        oldStatus,
        newStatus: 'archived',
        reason: reason || 'No reason provided',
      })

      logger.info('Post hidden', {
        adminId,
        postId: contentId,
        reason,
      })
    } else if (contentType === 'comment') {
      // Delete comment
      const comment = await Comment.findById(contentId)

      if (!comment) {
        throw new NotFoundError('Comment')
      }

      // Store comment data for audit log before deletion
      const commentData = {
        author: comment.author,
        content: comment.content,
        post: comment.post,
        issue: comment.issue,
      }

      await Comment.findByIdAndDelete(contentId)

      // Update comment count on parent post or issue
      if (comment.post) {
        await Post.findByIdAndUpdate(comment.post, { $inc: { commentCount: -1 } })
      } else if (comment.issue) {
        await Issue.findByIdAndUpdate(comment.issue, { $inc: { commentCount: -1 } })
      }

      // Create audit log entry
      await auditLog(adminId, 'delete_comment', 'comment', contentId, {
        commentData,
        reason: reason || 'No reason provided',
      })

      logger.info('Comment deleted', {
        adminId,
        commentId: contentId,
        reason,
      })
    } else {
      throw new ValidationError('Invalid content type', [
        { field: 'contentType', message: 'Content type must be post or comment' },
      ])
    }
  } catch (error) {
    logger.error('Failed to hide content', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId,
      data,
    })
    throw error
  }
}

/**
 * Get system metrics
 */
export const getSystemMetrics = async (): Promise<SystemMetrics> => {
  try {
    // Get counts in parallel
    const [userCount, postCount, issueCount, commentCount, onlineUserIds] = await Promise.all([
      User.countDocuments(),
      Post.countDocuments({ status: 'published' }),
      Issue.countDocuments(),
      Comment.countDocuments(),
      getOnlineUsers(),
    ])

    const activeUsers = onlineUserIds.length

    const metrics: SystemMetrics = {
      userCount,
      postCount,
      activeUsers,
      issueCount,
      commentCount,
      timestamp: new Date(),
    }

    logger.info('Retrieved system metrics', metrics)

    return metrics
  } catch (error) {
    logger.error('Failed to get system metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Create audit log entry
 */
export const auditLog = async (
  adminId: string,
  action: string,
  targetType: 'user' | 'post' | 'comment' | 'issue',
  targetId: string,
  details: Record<string, any> = {}
): Promise<any> => {
  try {
    const logEntry = new AuditLog({
      adminId: new mongoose.Types.ObjectId(adminId),
      action,
      targetType,
      targetId: new mongoose.Types.ObjectId(targetId),
      details,
      timestamp: new Date(),
    })

    await logEntry.save()

    logger.info('Audit log entry created', {
      adminId,
      action,
      targetType,
      targetId,
    })

    return logEntry.toObject()
  } catch (error) {
    logger.error('Failed to create audit log entry', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId,
      action,
      targetType,
      targetId,
    })
    throw error
  }
}

/**
 * Get audit logs with pagination
 */
export const getAuditLogs = async (
  page: number = 1,
  limit: number = 50
): Promise<{ logs: any[]; total: number; page: number; totalPages: number }> => {
  try {
    const skip = (page - 1) * limit

    const [logs, total] = await Promise.all([
      AuditLog.find()
        .populate('adminId', 'username email')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(),
    ])

    const totalPages = Math.ceil(total / limit)

    logger.info('Retrieved audit logs', { page, limit, total })

    return {
      logs,
      total,
      page,
      totalPages,
    }
  } catch (error) {
    logger.error('Failed to get audit logs', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}
