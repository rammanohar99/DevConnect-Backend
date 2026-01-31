import { User, IUser } from './user.model'
import {
  UpdateProfileDTO,
  UserResponse,
  PublicProfile,
  UserListItem,
  mapUserToResponse,
  mapUserToPublicProfile,
} from './user.types'
import { NotFoundError, ValidationError } from '../../shared/types/errors'
import logger from '../../shared/utils/logger'
import { logPasswordChanged } from '../../shared/utils/securityLogger'

export class UserService {
  /**
   * Get all users (for chat user selection)
   * @param options - Search and limit options
   * @returns Array of users
   */
  async getAllUsers(options: { search?: string; limit?: number }): Promise<UserListItem[]> {
    try {
      const { search, limit = 50 } = options
      const query: any = {}

      // Add search filter if provided
      if (search) {
        query.$or = [
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { 'profile.name': { $regex: search, $options: 'i' } },
        ]
      }

      const users = await User.find(query)
        .select('username email profile.name profile.avatar')
        .limit(Math.min(limit, 100))
        .lean()

      logger.debug('Users retrieved', { count: users.length, search })

      return users.map((user) => ({
        _id: user._id.toString(),
        username: user.username,
        email: user.email,
        profile: {
          name: user.profile.name,
          avatar: user.profile.avatar,
        },
      }))
    } catch (error) {
      logger.error('Error retrieving users', { error })
      throw error
    }
  }

  /**
   * Get user by ID
   * @param userId - User ID
   * @returns User document
   * @throws NotFoundError if user not found
   */
  async getUserById(userId: string): Promise<IUser> {
    try {
      const user = await User.findById(userId)

      if (!user) {
        throw new NotFoundError('User')
      }

      logger.debug('User retrieved', { userId })
      return user
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error
      }
      logger.error('Error retrieving user', { userId, error })
      throw error
    }
  }

  /**
   * Update user profile
   * @param userId - User ID
   * @param data - Profile update data
   * @returns Updated user response
   * @throws NotFoundError if user not found
   */
  async updateProfile(userId: string, data: UpdateProfileDTO): Promise<UserResponse> {
    try {
      const user = await User.findById(userId)

      if (!user) {
        throw new NotFoundError('User')
      }

      // Update profile fields
      if (data.name !== undefined) {
        user.profile.name = data.name
      }
      if (data.bio !== undefined) {
        user.profile.bio = data.bio
      }
      if (data.skills !== undefined) {
        user.profile.skills = data.skills
      }
      if (data.socialLinks !== undefined) {
        user.profile.socialLinks = {
          ...user.profile.socialLinks,
          ...data.socialLinks,
        }
      }

      await user.save()

      logger.info('User profile updated', { userId })
      return mapUserToResponse(user)
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error
      }
      logger.error('Error updating user profile', { userId, error })
      throw error
    }
  }

  /**
   * Get public user profile (filtered fields)
   * @param userId - User ID
   * @returns Public profile data
   * @throws NotFoundError if user not found
   */
  async getUserProfile(userId: string): Promise<PublicProfile> {
    try {
      const user = await User.findById(userId)

      if (!user) {
        throw new NotFoundError('User')
      }

      logger.debug('Public profile retrieved', { userId })
      return mapUserToPublicProfile(user)
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error
      }
      logger.error('Error retrieving public profile', { userId, error })
      throw error
    }
  }

  /**
   * Update user avatar URL
   * @param userId - User ID
   * @param avatarUrl - Avatar URL from S3
   * @returns Updated user response
   * @throws NotFoundError if user not found
   */
  async updateAvatar(userId: string, avatarUrl: string): Promise<UserResponse> {
    try {
      const user = await User.findById(userId)

      if (!user) {
        throw new NotFoundError('User')
      }

      user.profile.avatar = avatarUrl
      await user.save()

      logger.info('User avatar updated', { userId, avatarUrl })
      return mapUserToResponse(user)
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error
      }
      logger.error('Error updating user avatar', { userId, error })
      throw error
    }
  }

  /**
   * Change user password
   * @param userId - User ID
   * @param currentPassword - Current password
   * @param newPassword - New password
   * @param ip - IP address for security logging
   * @returns Updated user response
   * @throws NotFoundError if user not found
   * @throws ValidationError if current password is incorrect
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ip: string
  ): Promise<UserResponse> {
    try {
      // Must explicitly select password field since it has select: false in schema
      const user = await User.findById(userId).select('+password')

      if (!user) {
        throw new NotFoundError('User')
      }

      // Verify current password
      const isPasswordValid = await user.comparePassword(currentPassword)

      if (!isPasswordValid) {
        throw new ValidationError('Invalid current password', [
          {
            field: 'currentPassword',
            message: 'Current password is incorrect',
          },
        ])
      }

      // Update password (will be hashed by pre-save hook)
      user.password = newPassword
      await user.save()

      // Log security event
      logPasswordChanged(userId, user.email, ip)

      logger.info('User password changed', { userId })
      return mapUserToResponse(user)
    } catch (error) {
      if (error instanceof NotFoundError || error instanceof ValidationError) {
        throw error
      }
      logger.error('Error changing user password', { userId, error })
      throw error
    }
  }

  /**
   * Update notification preferences
   * @param userId - User ID
   * @param preferences - Notification preferences
   * @returns Updated user response
   * @throws NotFoundError if user not found
   */
  async updateNotificationPreferences(
    userId: string,
    preferences: {
      email?: boolean
      push?: boolean
      postComments?: boolean
      issueUpdates?: boolean
      chatMessages?: boolean
    }
  ): Promise<UserResponse> {
    try {
      const user = await User.findById(userId)

      if (!user) {
        throw new NotFoundError('User')
      }

      // Update notification preferences
      if (preferences.email !== undefined) {
        user.notificationPreferences.email = preferences.email
      }
      if (preferences.push !== undefined) {
        user.notificationPreferences.push = preferences.push
      }
      if (preferences.postComments !== undefined) {
        user.notificationPreferences.postComments = preferences.postComments
      }
      if (preferences.issueUpdates !== undefined) {
        user.notificationPreferences.issueUpdates = preferences.issueUpdates
      }
      if (preferences.chatMessages !== undefined) {
        user.notificationPreferences.chatMessages = preferences.chatMessages
      }

      await user.save()

      logger.info('User notification preferences updated', { userId })
      return mapUserToResponse(user)
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error
      }
      logger.error('Error updating notification preferences', { userId, error })
      throw error
    }
  }
}

export const userService = new UserService()
