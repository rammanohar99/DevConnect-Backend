import mongoose from 'mongoose'
import { Post, IPost } from './post.model'
import { Comment, IComment } from './comment.model'
import {
  CreatePostDTO,
  PostFilters,
  Pagination,
  PaginatedPosts,
  CreateCommentDTO,
} from './post.types'
import { NotFoundError } from '../../shared/types/errors'
import { cacheService, CacheKeys, CacheTTL } from '../../shared/utils/cache'
import logger from '../../shared/utils/logger'
import { notificationService } from '../notifications/notification.service'

export class PostService {
  /**
   * Create a new post
   */
  async createPost(userId: string, data: CreatePostDTO): Promise<IPost> {
    const post = new Post({
      author: userId,
      title: data.title,
      content: data.content,
      tags: data.tags || [],
      status: data.status || 'published',
    })

    await post.save()

    // Invalidate post list and search caches after creating a new post
    await this.invalidatePostCaches()

    return post
  }

  /**
   * Get a post by ID and increment view count atomically
   * Uses cache-aside pattern: check cache first, then database
   */
  async getPost(postId: string): Promise<IPost> {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw new NotFoundError('Post')
    }

    // Try to get from cache first
    const cacheKey = CacheKeys.post(postId)
    const cachedPost = await cacheService.get<IPost>(cacheKey)

    if (cachedPost) {
      logger.debug('Cache hit for post:', { postId })
      // Still increment view count in database (don't cache view count)
      await Post.findByIdAndUpdate(postId, { $inc: { viewCount: 1 } })
      return cachedPost
    }

    logger.debug('Cache miss for post:', { postId })

    // Increment view count atomically
    const post = await Post.findByIdAndUpdate(
      postId,
      { $inc: { viewCount: 1 } },
      { new: true }
    ).populate('author', 'username profile.name profile.avatar')

    if (!post) {
      throw new NotFoundError('Post')
    }

    // Cache the post for future requests
    await cacheService.set(cacheKey, post, CacheTTL.POSTS)

    return post
  }

  /**
   * List posts with pagination and filtering
   * Uses cache-aside pattern for post listings
   */
  async listPosts(filters: PostFilters, pagination: Pagination): Promise<PaginatedPosts> {
    const { page = 1, limit = 10 } = pagination

    // Generate cache key based on filters and pagination
    const cacheKey = CacheKeys.postList({ ...filters, page, limit })

    // Try to get from cache first
    const cachedResult = await cacheService.get<PaginatedPosts>(cacheKey)

    if (cachedResult) {
      logger.debug('Cache hit for post list:', { filters, page, limit })
      return cachedResult
    }

    logger.debug('Cache miss for post list:', { filters, page, limit })

    const skip = (page - 1) * limit

    // Build query
    const query: any = {}

    if (filters.author) {
      query.author = filters.author
    }

    if (filters.tags && filters.tags.length > 0) {
      query.tags = { $in: filters.tags }
    }

    if (filters.status) {
      query.status = filters.status
    } else {
      // Default to only published posts
      query.status = 'published'
    }

    // Execute query with pagination
    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate('author', 'username profile.name profile.avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      Post.countDocuments(query),
    ])

    const totalPages = Math.ceil(total / limit)

    const result: PaginatedPosts = {
      posts: posts as unknown as IPost[],
      total,
      page,
      totalPages,
      hasMore: page < totalPages,
    }

    // Cache the result
    await cacheService.set(cacheKey, result, CacheTTL.POSTS)

    return result
  }

  /**
   * Like a post (idempotent - won't add duplicate likes)
   */
  async likePost(postId: string, userId: string): Promise<void> {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw new NotFoundError('Post')
    }

    const post = await Post.findById(postId)
    if (!post) {
      throw new NotFoundError('Post')
    }

    // Check if user already liked the post
    const userObjectId = new mongoose.Types.ObjectId(userId)
    const alreadyLiked = post.likes.some((id) => id.equals(userObjectId))

    if (!alreadyLiked) {
      post.likes.push(userObjectId)
      await post.save()

      // Invalidate caches after liking
      await this.invalidatePostCaches(postId)

      // Create notification for post author (async, don't await)
      this.createLikeNotification(post.author.toString(), userId, postId, post.title).catch(
        (error) => {
          logger.error('Error creating like notification:', error)
        }
      )
    }
  }

  /**
   * Unlike a post
   */
  async unlikePost(postId: string, userId: string): Promise<void> {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw new NotFoundError('Post')
    }

    const post = await Post.findById(postId)
    if (!post) {
      throw new NotFoundError('Post')
    }

    // Remove user from likes array
    const userObjectId = new mongoose.Types.ObjectId(userId)
    post.likes = post.likes.filter((id) => !id.equals(userObjectId))
    await post.save()

    // Invalidate caches after unliking
    await this.invalidatePostCaches(postId)
  }

  /**
   * Bookmark a post (idempotent)
   */
  async bookmarkPost(postId: string, userId: string): Promise<void> {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw new NotFoundError('Post')
    }

    const post = await Post.findById(postId)
    if (!post) {
      throw new NotFoundError('Post')
    }

    // Check if user already bookmarked the post
    const userObjectId = new mongoose.Types.ObjectId(userId)
    const alreadyBookmarked = post.bookmarks.some((id) => id.equals(userObjectId))

    if (!alreadyBookmarked) {
      post.bookmarks.push(userObjectId)
      await post.save()

      // Invalidate caches after bookmarking
      await this.invalidatePostCaches(postId)
    }
  }

  /**
   * Unbookmark a post
   */
  async unbookmarkPost(postId: string, userId: string): Promise<void> {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw new NotFoundError('Post')
    }

    const post = await Post.findById(postId)
    if (!post) {
      throw new NotFoundError('Post')
    }

    // Remove user from bookmarks array
    const userObjectId = new mongoose.Types.ObjectId(userId)
    post.bookmarks = post.bookmarks.filter((id) => !id.equals(userObjectId))
    await post.save()

    // Invalidate caches after unbookmarking
    await this.invalidatePostCaches(postId)
  }

  /**
   * Add a comment to a post
   */
  async addComment(postId: string, userId: string, data: CreateCommentDTO): Promise<IComment> {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw new NotFoundError('Post')
    }

    // Verify post exists
    const post = await Post.findById(postId)
    if (!post) {
      throw new NotFoundError('Post')
    }

    // Validate parent comment if provided
    if (data.parentComment) {
      if (!mongoose.Types.ObjectId.isValid(data.parentComment)) {
        throw new NotFoundError('Parent comment')
      }

      const parentComment = await Comment.findById(data.parentComment)
      if (!parentComment) {
        throw new NotFoundError('Parent comment')
      }

      // Ensure parent comment belongs to the same post
      if (parentComment.post?.toString() !== postId) {
        throw new Error('Parent comment does not belong to this post')
      }
    }

    // Create comment
    const comment = new Comment({
      author: userId,
      post: postId,
      content: data.content,
      parentComment: data.parentComment || null,
    })

    await comment.save()

    // Increment comment count on post atomically
    await Post.findByIdAndUpdate(postId, { $inc: { commentCount: 1 } })

    // Populate author information
    await comment.populate('author', 'username profile.name profile.avatar')

    // Invalidate caches after adding comment
    await this.invalidatePostCaches(postId)

    // Create notification for post author (async, don't await)
    this.createCommentNotification(
      post.author.toString(),
      userId,
      postId,
      post.title,
      comment._id.toString()
    ).catch((error) => {
      logger.error('Error creating comment notification:', error)
    })

    // Parse and create mention notifications (async, don't await)
    this.createMentionNotifications(data.content, userId, postId, post.title).catch((error) => {
      logger.error('Error creating mention notifications:', error)
    })

    return comment
  }

  /**
   * Get comments for a post
   */
  async getComments(postId: string, pagination: Pagination): Promise<IComment[]> {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      throw new NotFoundError('Post')
    }

    const { page = 1, limit = 20 } = pagination
    const skip = (page - 1) * limit

    const comments = await Comment.find({ post: postId, parentComment: null })
      .populate('author', 'username profile.name profile.avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec()

    return comments as unknown as IComment[]
  }

  /**
   * Get user's bookmarked posts
   */
  async getBookmarkedPosts(userId: string, pagination: Pagination): Promise<PaginatedPosts> {
    const { page = 1, limit = 10 } = pagination
    const skip = (page - 1) * limit

    const userObjectId = new mongoose.Types.ObjectId(userId)

    const [posts, total] = await Promise.all([
      Post.find({ bookmarks: userObjectId, status: 'published' })
        .populate('author', 'username profile.name profile.avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      Post.countDocuments({ bookmarks: userObjectId, status: 'published' }),
    ])

    const totalPages = Math.ceil(total / limit)

    return {
      posts: posts as unknown as IPost[],
      total,
      page,
      totalPages,
      hasMore: page < totalPages,
    }
  }

  /**
   * Check if user has liked a post
   */
  async hasUserLikedPost(postId: string, userId: string): Promise<boolean> {
    const post = await Post.findById(postId).select('likes').lean()
    if (!post) {
      return false
    }

    const userObjectId = new mongoose.Types.ObjectId(userId)
    return post.likes.some((id) => id.equals(userObjectId))
  }

  /**
   * Check if user has bookmarked a post
   */
  async hasUserBookmarkedPost(postId: string, userId: string): Promise<boolean> {
    const post = await Post.findById(postId).select('bookmarks').lean()
    if (!post) {
      return false
    }

    const userObjectId = new mongoose.Types.ObjectId(userId)
    return post.bookmarks.some((id) => id.equals(userObjectId))
  }

  /**
   * Search posts with keyword matching and filtering
   * Uses cache-aside pattern for search results
   */
  async searchPosts(
    query: string,
    filters: PostFilters,
    pagination: Pagination,
    sortBy: 'date' | 'popularity' | 'relevance' = 'relevance'
  ): Promise<PaginatedPosts> {
    const { page = 1, limit = 10 } = pagination

    // Generate cache key for search results
    const cacheKey = CacheKeys.search(query, filters, sortBy, page)

    // Try to get from cache first
    const cachedResult = await cacheService.get<PaginatedPosts>(cacheKey)

    if (cachedResult) {
      logger.debug('Cache hit for search:', { query, filters, sortBy, page })
      return cachedResult
    }

    logger.debug('Cache miss for search:', { query, filters, sortBy, page })

    const skip = (page - 1) * limit

    // Build search query
    const searchQuery: any = {
      status: filters.status || 'published',
    }

    // Text search if query provided
    if (query && query.trim()) {
      searchQuery.$text = { $search: query }
    }

    // Filter by tags
    if (filters.tags && filters.tags.length > 0) {
      searchQuery.tags = { $in: filters.tags }
    }

    // Filter by author
    if (filters.author) {
      searchQuery.author = filters.author
    }

    // Determine sort order
    let sortOptions: any = {}
    switch (sortBy) {
      case 'date':
        sortOptions = { createdAt: -1 }
        break
      case 'popularity':
        // Sort by combined likes and comments (popularity score)
        sortOptions = { likeCount: -1, commentCount: -1, createdAt: -1 }
        break
      case 'relevance':
        // If text search is used, sort by text score, otherwise by date
        if (query && query.trim()) {
          sortOptions = { score: { $meta: 'textScore' }, createdAt: -1 }
        } else {
          sortOptions = { createdAt: -1 }
        }
        break
      default:
        sortOptions = { createdAt: -1 }
    }

    let result: PaginatedPosts

    // Build aggregation pipeline for popularity sorting
    if (sortBy === 'popularity') {
      const pipeline: any[] = [
        { $match: searchQuery },
        {
          $addFields: {
            likeCount: { $size: '$likes' },
            bookmarkCount: { $size: '$bookmarks' },
          },
        },
        { $sort: sortOptions },
        { $skip: skip },
        { $limit: limit },
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'author',
          },
        },
        { $unwind: '$author' },
        {
          $project: {
            'author.password': 0,
            'author.refreshTokens': 0,
            'author.__v': 0,
          },
        },
      ]

      const [posts, countResult] = await Promise.all([
        Post.aggregate(pipeline),
        Post.countDocuments(searchQuery),
      ])

      const totalPages = Math.ceil(countResult / limit)

      result = {
        posts: posts as unknown as IPost[],
        total: countResult,
        page,
        totalPages,
        hasMore: page < totalPages,
      }
    } else {
      // For date and relevance sorting, use regular query
      const queryBuilder = Post.find(searchQuery)
        .populate('author', 'username profile.name profile.avatar')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)

      // Add text score projection for relevance sorting
      if (sortBy === 'relevance' && query && query.trim()) {
        queryBuilder.select({ score: { $meta: 'textScore' } })
      }

      const [posts, total] = await Promise.all([
        queryBuilder.lean().exec(),
        Post.countDocuments(searchQuery),
      ])

      const totalPages = Math.ceil(total / limit)

      result = {
        posts: posts as unknown as IPost[],
        total,
        page,
        totalPages,
        hasMore: page < totalPages,
      }
    }

    // Cache the search results
    await cacheService.set(cacheKey, result, CacheTTL.SEARCH)

    return result
  }

  /**
   * Get posts by tag
   */
  async getPostsByTag(tag: string, pagination: Pagination): Promise<PaginatedPosts> {
    return this.listPosts({ tags: [tag], status: 'published' }, pagination)
  }

  /**
   * Get trending posts (most popular in last 7 days)
   */
  async getTrendingPosts(pagination: Pagination): Promise<PaginatedPosts> {
    const { page = 1, limit = 10 } = pagination
    const skip = (page - 1) * limit

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const pipeline: any[] = [
      {
        $match: {
          status: 'published',
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $addFields: {
          likeCount: { $size: '$likes' },
          popularityScore: {
            $add: [{ $size: '$likes' }, { $multiply: ['$commentCount', 2] }, '$viewCount'],
          },
        },
      },
      { $sort: { popularityScore: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'author',
        },
      },
      { $unwind: '$author' },
      {
        $project: {
          'author.password': 0,
          'author.refreshTokens': 0,
          'author.__v': 0,
        },
      },
    ]

    const [posts, countResult] = await Promise.all([
      Post.aggregate(pipeline),
      Post.countDocuments({
        status: 'published',
        createdAt: { $gte: sevenDaysAgo },
      }),
    ])

    const totalPages = Math.ceil(countResult / limit)

    return {
      posts: posts as unknown as IPost[],
      total: countResult,
      page,
      totalPages,
      hasMore: page < totalPages,
    }
  }

  /**
   * Invalidate all caches related to posts
   * Called after any post modification (create, like, comment, etc.)
   */
  private async invalidatePostCaches(postId?: string): Promise<void> {
    try {
      // Invalidate specific post cache if postId provided
      if (postId) {
        await cacheService.delete(CacheKeys.post(postId))
      }

      // Invalidate all post list caches
      await cacheService.invalidatePattern(CacheKeys.postListPattern())

      // Invalidate all search caches
      await cacheService.invalidatePattern(CacheKeys.searchPattern())

      logger.debug('Post caches invalidated', { postId })
    } catch (error) {
      logger.error('Error invalidating post caches:', error)
      // Don't throw - cache invalidation failures shouldn't break the operation
    }
  }

  /**
   * Create a notification for post like
   * Called asynchronously, errors are logged but don't break the flow
   */
  private async createLikeNotification(
    postAuthorId: string,
    likerId: string,
    postId: string,
    postTitle: string
  ): Promise<void> {
    await notificationService.createNotification({
      recipientId: postAuthorId,
      type: 'like',
      actorId: likerId,
      message: `liked your post "${postTitle}"`,
      resource: {
        type: 'post',
        id: postId,
      },
    })
  }

  /**
   * Create a notification for post comment
   * Called asynchronously, errors are logged but don't break the flow
   */
  private async createCommentNotification(
    postAuthorId: string,
    commenterId: string,
    postId: string,
    postTitle: string,
    _commentId: string
  ): Promise<void> {
    await notificationService.createNotification({
      recipientId: postAuthorId,
      type: 'comment',
      actorId: commenterId,
      message: `commented on your post "${postTitle}"`,
      resource: {
        type: 'post',
        id: postId,
      },
    })
  }

  /**
   * Parse content for @mentions and create notifications
   * Mentions format: @username
   */
  private async createMentionNotifications(
    content: string,
    mentionerId: string,
    postId: string,
    postTitle: string
  ): Promise<void> {
    // Extract mentions using regex: @username (alphanumeric and underscore)
    const mentionRegex = /@(\w+)/g
    const mentions = content.match(mentionRegex)

    if (!mentions || mentions.length === 0) {
      return
    }

    // Extract unique usernames (remove @ and deduplicate)
    const usernames = [...new Set(mentions.map((m) => m.substring(1)))]

    // Import User model dynamically to avoid circular dependencies
    const { User } = await import('../users/user.model')

    // Find users by username
    const users = await User.find({ username: { $in: usernames } })
      .select('_id username')
      .lean()

    // Create notification for each mentioned user
    for (const user of users) {
      await notificationService.createNotification({
        recipientId: user._id.toString(),
        type: 'mention',
        actorId: mentionerId,
        message: `mentioned you in a post "${postTitle}"`,
        resource: {
          type: 'post',
          id: postId,
        },
      })
    }
  }
}

export const postService = new PostService()
