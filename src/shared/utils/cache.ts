import { getRedisClient } from '../../config/redis'
import logger from './logger'

/**
 * TTL configuration per resource type (in seconds)
 */
export const CacheTTL = {
  USERS: 5 * 60, // 5 minutes
  POSTS: 2 * 60, // 2 minutes
  SEARCH: 1 * 60, // 1 minute
  COMMENTS: 2 * 60, // 2 minutes
  ISSUES: 3 * 60, // 3 minutes
} as const

/**
 * Cache key prefixes for consistent naming
 */
export const CachePrefix = {
  USER: 'user',
  POST: 'post',
  POST_LIST: 'post:list',
  SEARCH: 'search',
  COMMENT: 'comment',
  ISSUE: 'issue',
} as const

/**
 * Cache service wrapper for Redis operations
 * Implements graceful degradation on Redis failures
 */
export class CacheService {
  /**
   * Get a value from cache
   * Returns null if key doesn't exist or on Redis failure
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = getRedisClient()
      const value = await client.get(key)

      if (!value) {
        return null
      }

      return JSON.parse(value) as T
    } catch (error) {
      logger.error('Cache get error (graceful degradation):', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return null
    }
  }

  /**
   * Set a value in cache with optional TTL
   * Fails gracefully on Redis errors
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const client = getRedisClient()
      const serialized = JSON.stringify(value)

      if (ttl) {
        await client.setEx(key, ttl, serialized)
      } else {
        await client.set(key, serialized)
      }

      logger.debug('Cache set:', { key, ttl })
    } catch (error) {
      logger.error('Cache set error (graceful degradation):', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      // Fail gracefully - don't throw error
    }
  }

  /**
   * Delete a key from cache
   * Fails gracefully on Redis errors
   */
  async delete(key: string): Promise<void> {
    try {
      const client = getRedisClient()
      await client.del(key)
      logger.debug('Cache delete:', { key })
    } catch (error) {
      logger.error('Cache delete error (graceful degradation):', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      // Fail gracefully - don't throw error
    }
  }

  /**
   * Invalidate all keys matching a pattern
   * Uses SCAN for safe iteration over large keyspaces
   * Fails gracefully on Redis errors
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const client = getRedisClient()
      const keys: string[] = []

      // Use SCAN to iterate through keys matching pattern
      for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
        keys.push(key)
      }

      if (keys.length > 0) {
        await client.del(keys)
        logger.debug('Cache invalidate pattern:', { pattern, count: keys.length })
      }
    } catch (error) {
      logger.error('Cache invalidate pattern error (graceful degradation):', {
        pattern,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      // Fail gracefully - don't throw error
    }
  }

  /**
   * Check if a key exists in cache
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = getRedisClient()
      const result = await client.exists(key)
      return result === 1
    } catch (error) {
      logger.error('Cache exists error (graceful degradation):', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return false
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const client = getRedisClient()
      const values = await client.mGet(keys)

      return values.map((value) => {
        if (!value) return null
        try {
          return JSON.parse(value) as T
        } catch {
          return null
        }
      })
    } catch (error) {
      logger.error('Cache mget error (graceful degradation):', {
        keys,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return keys.map(() => null)
    }
  }

  /**
   * Set multiple values in cache
   */
  async mset(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    try {
      const client = getRedisClient()

      // Group entries by TTL
      const withoutTTL: Array<[string, string]> = []
      const withTTL: Array<{ key: string; value: string; ttl: number }> = []

      for (const entry of entries) {
        const serialized = JSON.stringify(entry.value)
        if (entry.ttl) {
          withTTL.push({ key: entry.key, value: serialized, ttl: entry.ttl })
        } else {
          withoutTTL.push([entry.key, serialized])
        }
      }

      // Set entries without TTL using MSET
      if (withoutTTL.length > 0) {
        await client.mSet(withoutTTL)
      }

      // Set entries with TTL individually
      for (const entry of withTTL) {
        await client.setEx(entry.key, entry.ttl, entry.value)
      }

      logger.debug('Cache mset:', { count: entries.length })
    } catch (error) {
      logger.error('Cache mset error (graceful degradation):', {
        count: entries.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      // Fail gracefully - don't throw error
    }
  }

  /**
   * Increment a counter in cache
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      const client = getRedisClient()
      return await client.incrBy(key, amount)
    } catch (error) {
      logger.error('Cache increment error (graceful degradation):', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return 0
    }
  }

  /**
   * Decrement a counter in cache
   */
  async decrement(key: string, amount: number = 1): Promise<number> {
    try {
      const client = getRedisClient()
      return await client.decrBy(key, amount)
    } catch (error) {
      logger.error('Cache decrement error (graceful degradation):', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return 0
    }
  }
}

/**
 * Cache key generation utilities
 */
export const CacheKeys = {
  /**
   * Generate cache key for a user
   */
  user: (userId: string): string => `${CachePrefix.USER}:${userId}`,

  /**
   * Generate cache key for a post
   */
  post: (postId: string): string => `${CachePrefix.POST}:${postId}`,

  /**
   * Generate cache key for post list with filters
   */
  postList: (filters: {
    author?: string
    tags?: string[]
    status?: string
    page?: number
    limit?: number
  }): string => {
    const parts: string[] = [CachePrefix.POST_LIST]

    if (filters.author) parts.push(`author:${filters.author}`)
    if (filters.tags && filters.tags.length > 0) {
      parts.push(`tags:${filters.tags.sort().join(',')}`)
    }
    if (filters.status) parts.push(`status:${filters.status}`)
    if (filters.page) parts.push(`page:${filters.page}`)
    if (filters.limit) parts.push(`limit:${filters.limit}`)

    return parts.join(':')
  },

  /**
   * Generate cache key for search results
   */
  search: (query: string, filters: any, sortBy?: string, page?: number): string => {
    const parts: string[] = [CachePrefix.SEARCH, `q:${query}`]

    if (filters.tags && filters.tags.length > 0) {
      parts.push(`tags:${filters.tags.sort().join(',')}`)
    }
    if (filters.author) parts.push(`author:${filters.author}`)
    if (sortBy) parts.push(`sort:${sortBy}`)
    if (page) parts.push(`page:${page}`)

    return parts.join(':')
  },

  /**
   * Generate cache key for comments
   */
  comments: (postId: string, page?: number): string => {
    const parts: string[] = [CachePrefix.COMMENT, `post:${postId}`]
    if (page) parts.push(`page:${page}`)
    return parts.join(':')
  },

  /**
   * Generate pattern for invalidating all post-related caches
   */
  postPattern: (postId?: string): string => {
    if (postId) {
      return `${CachePrefix.POST}:${postId}*`
    }
    return `${CachePrefix.POST}*`
  },

  /**
   * Generate pattern for invalidating all post list caches
   */
  postListPattern: (): string => `${CachePrefix.POST_LIST}*`,

  /**
   * Generate pattern for invalidating all search caches
   */
  searchPattern: (): string => `${CachePrefix.SEARCH}*`,
}

// Export singleton instance
export const cacheService = new CacheService()
