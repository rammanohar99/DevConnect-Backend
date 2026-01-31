import { Request, Response, NextFunction } from 'express'
import { userService } from './user.service'
import { uploadFile, isFileTypeAllowed, isFileSizeAllowed, isS3Configured } from '../../config/s3'
import { ValidationError, AuthorizationError } from '../../shared/types/errors'
import logger from '../../shared/utils/logger'

export class UserController {
  /**
   * Get all users (for chat user selection)
   * GET /api/v1/users
   */
  async getAllUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { search, limit = 50 } = req.query

      const users = await userService.getAllUsers({
        search: search as string,
        limit: Number(limit),
      })

      logger.debug('Users retrieved', {
        count: users.length,
        requestedBy: req.user?.userId,
      })

      res.status(200).json({
        status: 'success',
        data: { users },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get user by ID
   * GET /api/v1/users/:id
   */
  async getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id
      const user = await userService.getUserById(userId)

      res.status(200).json({
        status: 'success',
        data: {
          user,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Update user profile
   * PUT /api/v1/users/:id/profile
   */
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id
      const authenticatedUserId = req.user?.userId

      // Check if user is updating their own profile
      if (userId !== authenticatedUserId) {
        throw new AuthorizationError('You can only update your own profile')
      }

      const updateData = req.body
      const updatedUser = await userService.updateProfile(userId, updateData)

      res.status(200).json({
        status: 'success',
        data: {
          user: updatedUser,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Upload user avatar
   * POST /api/v1/users/:id/avatar
   */
  async uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id
      const authenticatedUserId = req.user?.userId

      // Check if user is updating their own avatar
      if (userId !== authenticatedUserId) {
        throw new AuthorizationError('You can only update your own avatar')
      }

      // Check if S3 is configured
      if (!isS3Configured()) {
        throw new ValidationError('File upload is not configured', [
          {
            field: 'file',
            message: 'File upload service is not available',
          },
        ])
      }

      // Check if file was uploaded
      if (!req.file) {
        throw new ValidationError('No file uploaded', [
          {
            field: 'file',
            message: 'Please upload an image file',
          },
        ])
      }

      const file = req.file

      // Validate file type
      if (!isFileTypeAllowed(file.mimetype)) {
        throw new ValidationError('Invalid file type', [
          {
            field: 'file',
            message: 'Only image files (JPEG, PNG, GIF, WebP) are allowed',
          },
        ])
      }

      // Validate file size
      if (!isFileSizeAllowed(file.size)) {
        throw new ValidationError('File too large', [
          {
            field: 'file',
            message: `File size must not exceed ${Math.round(5242880 / 1024 / 1024)}MB`,
          },
        ])
      }

      // Upload to S3
      const avatarUrl = await uploadFile(file.buffer, file.originalname, file.mimetype, 'avatars')

      // Update user avatar in database
      const updatedUser = await userService.updateAvatar(userId, avatarUrl)

      logger.info('Avatar uploaded successfully', { userId, avatarUrl })

      res.status(200).json({
        status: 'success',
        data: {
          user: updatedUser,
          avatarUrl,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get public user profile
   * GET /api/v1/users/:id/public
   */
  async getPublicProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id
      const publicProfile = await userService.getUserProfile(userId)

      res.status(200).json({
        status: 'success',
        data: {
          profile: publicProfile,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Change user password
   * PUT /api/v1/users/:id/password
   */
  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.params.id
      const authenticatedUserId = req.user?.userId

      // Check if user is changing their own password
      if (userId !== authenticatedUserId) {
        throw new AuthorizationError('You can only change your own password')
      }

      const { currentPassword, newPassword } = req.body
      const ip = req.ip || 'unknown'

      const updatedUser = await userService.changePassword(userId, currentPassword, newPassword, ip)

      res.status(200).json({
        status: 'success',
        message: 'Password changed successfully',
        data: {
          user: updatedUser,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Update notification preferences
   * PATCH /api/v1/users/:id/settings/notifications
   */
  async updateNotificationPreferences(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.params.id
      const authenticatedUserId = req.user?.userId

      // Check if user is updating their own settings
      if (userId !== authenticatedUserId) {
        throw new AuthorizationError('You can only update your own settings')
      }

      const preferences = req.body
      const updatedUser = await userService.updateNotificationPreferences(userId, preferences)

      res.status(200).json({
        status: 'success',
        message: 'Notification preferences updated successfully',
        data: {
          user: updatedUser,
        },
      })
    } catch (error) {
      next(error)
    }
  }
}

export const userController = new UserController()
