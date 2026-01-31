import { Request, Response, NextFunction } from 'express'
import { postService } from './post.service'
import { CreatePostDTO, CreateCommentDTO } from './post.types'

export class PostController {
  /**
   * Create a new post
   * POST /api/v1/posts
   */
  async createPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId
      const postData: CreatePostDTO = req.body

      const post = await postService.createPost(userId, postData)

      res.status(201).json({
        status: 'success',
        data: { post },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get a single post by ID
   * GET /api/v1/posts/:id
   */
  async getPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const userId = req.user?.userId

      const post = await postService.getPost(id)

      // Check if user has liked or bookmarked the post
      let isLiked = false
      let isBookmarked = false

      if (userId) {
        ;[isLiked, isBookmarked] = await Promise.all([
          postService.hasUserLikedPost(id, userId),
          postService.hasUserBookmarkedPost(id, userId),
        ])
      }

      res.status(200).json({
        status: 'success',
        data: {
          post: {
            ...post.toObject(),
            isLiked,
            isBookmarked,
          },
        },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * List posts with pagination and filters
   * GET /api/v1/posts
   */
  async listPosts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, author, tags, status } = req.query

      const filters = {
        author: author as string | undefined,
        tags: tags as string[] | undefined,
        status: status as 'draft' | 'published' | 'archived' | undefined,
      }

      const pagination = {
        page: Number(page) || 1,
        limit: Number(limit) || 10,
      }

      const result = await postService.listPosts(filters, pagination)

      res.status(200).json({
        status: 'success',
        data: result,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Search posts
   * GET /api/v1/posts/search
   */
  async searchPosts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q, page, limit, tags, sortBy } = req.query

      const filters = {
        tags: tags as string[] | undefined,
      }

      const pagination = {
        page: Number(page) || 1,
        limit: Number(limit) || 10,
      }

      const result = await postService.searchPosts(
        q as string,
        filters,
        pagination,
        (sortBy as 'date' | 'popularity' | 'relevance') || 'relevance'
      )

      res.status(200).json({
        status: 'success',
        data: result,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Like a post
   * POST /api/v1/posts/:id/like
   */
  async likePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const userId = req.user!.userId

      await postService.likePost(id, userId)

      res.status(200).json({
        status: 'success',
        message: 'Post liked successfully',
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Unlike a post
   * DELETE /api/v1/posts/:id/like
   */
  async unlikePost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const userId = req.user!.userId

      await postService.unlikePost(id, userId)

      res.status(200).json({
        status: 'success',
        message: 'Post unliked successfully',
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Bookmark a post
   * POST /api/v1/posts/:id/bookmark
   */
  async bookmarkPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const userId = req.user!.userId

      await postService.bookmarkPost(id, userId)

      res.status(200).json({
        status: 'success',
        message: 'Post bookmarked successfully',
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Unbookmark a post
   * DELETE /api/v1/posts/:id/bookmark
   */
  async unbookmarkPost(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const userId = req.user!.userId

      await postService.unbookmarkPost(id, userId)

      res.status(200).json({
        status: 'success',
        message: 'Post unbookmarked successfully',
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Add a comment to a post
   * POST /api/v1/posts/:id/comments
   */
  async addComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const userId = req.user!.userId
      const commentData: CreateCommentDTO = req.body

      const comment = await postService.addComment(id, userId, commentData)

      res.status(201).json({
        status: 'success',
        data: { comment },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get comments for a post
   * GET /api/v1/posts/:id/comments
   */
  async getComments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const { page, limit } = req.query

      const pagination = {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
      }

      const comments = await postService.getComments(id, pagination)

      res.status(200).json({
        status: 'success',
        data: { comments },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get user's bookmarked posts
   * GET /api/v1/posts/bookmarks
   */
  async getBookmarkedPosts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId
      const { page, limit } = req.query

      const pagination = {
        page: Number(page) || 1,
        limit: Number(limit) || 10,
      }

      const result = await postService.getBookmarkedPosts(userId, pagination)

      res.status(200).json({
        status: 'success',
        data: result,
      })
    } catch (error) {
      next(error)
    }
  }
}

export const postController = new PostController()
