import { getRedisClient } from '../../config/redis'
import { emitToUserAcrossInstances } from '../../socket/pubsub'
import logger from '../../shared/utils/logger'

const PRESENCE_KEY_PREFIX = 'presence:user:'
const ONLINE_USERS_SET = 'presence:online'
const PRESENCE_TTL = 300 // 5 minutes in seconds

export interface UserPresence {
  userId: string
  status: 'online' | 'offline'
  lastSeen: Date
  socketId?: string
}

/**
 * Mark a user as online
 */
export const setUserOnline = async (userId: string, socketId: string): Promise<void> => {
  try {
    const redis = getRedisClient()
    const presenceKey = `${PRESENCE_KEY_PREFIX}${userId}`

    const presenceData: UserPresence = {
      userId,
      status: 'online',
      lastSeen: new Date(),
      socketId,
    }

    // Store user presence with TTL
    await redis.setEx(presenceKey, PRESENCE_TTL, JSON.stringify(presenceData))

    // Add user to online users set
    await redis.sAdd(ONLINE_USERS_SET, userId)

    logger.debug('User marked as online', { userId, socketId })

    // Broadcast online status to relevant users
    await broadcastPresenceUpdate(userId, 'online')
  } catch (error) {
    logger.error('Failed to set user online', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Mark a user as offline
 */
export const setUserOffline = async (userId: string): Promise<void> => {
  try {
    const redis = getRedisClient()
    const presenceKey = `${PRESENCE_KEY_PREFIX}${userId}`

    const presenceData: UserPresence = {
      userId,
      status: 'offline',
      lastSeen: new Date(),
    }

    // Update presence data
    await redis.setEx(presenceKey, PRESENCE_TTL, JSON.stringify(presenceData))

    // Remove user from online users set
    await redis.sRem(ONLINE_USERS_SET, userId)

    logger.debug('User marked as offline', { userId })

    // Broadcast offline status to relevant users
    await broadcastPresenceUpdate(userId, 'offline')
  } catch (error) {
    logger.error('Failed to set user offline', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Get user presence status
 */
export const getUserPresence = async (userId: string): Promise<UserPresence | null> => {
  try {
    const redis = getRedisClient()
    const presenceKey = `${PRESENCE_KEY_PREFIX}${userId}`

    const presenceString = await redis.get(presenceKey)

    if (!presenceString) {
      return {
        userId,
        status: 'offline',
        lastSeen: new Date(),
      }
    }

    const presence: UserPresence = JSON.parse(presenceString)
    return presence
  } catch (error) {
    logger.error('Failed to get user presence', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return null
  }
}

/**
 * Get multiple users' presence status
 */
export const getMultipleUsersPresence = async (
  userIds: string[]
): Promise<Map<string, UserPresence>> => {
  try {
    const redis = getRedisClient()
    const presenceMap = new Map<string, UserPresence>()

    // Fetch all presence data in parallel
    const presencePromises = userIds.map(async (userId) => {
      const presenceKey = `${PRESENCE_KEY_PREFIX}${userId}`
      const presenceString = await redis.get(presenceKey)

      if (presenceString) {
        const presence: UserPresence = JSON.parse(presenceString)
        presenceMap.set(userId, presence)
      } else {
        presenceMap.set(userId, {
          userId,
          status: 'offline',
          lastSeen: new Date(),
        })
      }
    })

    await Promise.all(presencePromises)

    return presenceMap
  } catch (error) {
    logger.error('Failed to get multiple users presence', {
      userIds,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return new Map()
  }
}

/**
 * Get all online users
 */
export const getOnlineUsers = async (): Promise<string[]> => {
  try {
    const redis = getRedisClient()
    const onlineUsers = await redis.sMembers(ONLINE_USERS_SET)

    return onlineUsers
  } catch (error) {
    logger.error('Failed to get online users', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return []
  }
}

/**
 * Check if a user is online
 */
export const isUserOnline = async (userId: string): Promise<boolean> => {
  try {
    const redis = getRedisClient()
    const isMember = await redis.sIsMember(ONLINE_USERS_SET, userId)

    return isMember
  } catch (error) {
    logger.error('Failed to check if user is online', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return false
  }
}

/**
 * Refresh user presence TTL (heartbeat)
 */
export const refreshUserPresence = async (userId: string): Promise<void> => {
  try {
    const redis = getRedisClient()
    const presenceKey = `${PRESENCE_KEY_PREFIX}${userId}`

    // Get current presence data
    const presenceString = await redis.get(presenceKey)

    if (presenceString) {
      const presence: UserPresence = JSON.parse(presenceString)
      presence.lastSeen = new Date()

      // Refresh TTL
      await redis.setEx(presenceKey, PRESENCE_TTL, JSON.stringify(presence))

      logger.debug('User presence refreshed', { userId })
    }
  } catch (error) {
    logger.error('Failed to refresh user presence', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Broadcast presence update to relevant users
 */
const broadcastPresenceUpdate = async (
  userId: string,
  status: 'online' | 'offline'
): Promise<void> => {
  try {
    // In a real application, you would determine which users should receive this update
    // For example, friends, chat participants, etc.
    // For now, we'll emit to a general presence channel

    const presenceUpdate = {
      userId,
      status,
      timestamp: new Date().toISOString(),
    }

    // Emit to all users subscribed to presence updates
    await emitToUserAcrossInstances(userId, 'presence:update', presenceUpdate)

    logger.debug('Broadcast presence update', { userId, status })
  } catch (error) {
    logger.error('Failed to broadcast presence update', {
      userId,
      status,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * Clean up stale presence data (for maintenance tasks)
 */
export const cleanupStalePresence = async (): Promise<void> => {
  try {
    const redis = getRedisClient()
    const onlineUsers = await redis.sMembers(ONLINE_USERS_SET)

    let cleanedCount = 0

    for (const userId of onlineUsers) {
      const presenceKey = `${PRESENCE_KEY_PREFIX}${userId}`
      const exists = await redis.exists(presenceKey)

      // If presence key doesn't exist but user is in online set, remove them
      if (!exists) {
        await redis.sRem(ONLINE_USERS_SET, userId)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up stale presence data', { cleanedCount })
    }
  } catch (error) {
    logger.error('Failed to cleanup stale presence', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}
