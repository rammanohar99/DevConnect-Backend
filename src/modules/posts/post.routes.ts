import { Router } from 'express'
import { postController } from './post.controller'
import { authenticate, optionalAuth } from '../../shared/middleware/auth.middleware'
import { validate } from '../../shared/middleware/validation.middleware'
import {
  createPostSchema,
  getPostsSchema,
  searchPostsSchema,
  createCommentSchema,
  getCommentsSchema,
  postIdSchema,
} from './post.validation'

const router = Router()

/**
 * Public routes (with optional auth for personalized data)
 * Note: Specific routes must come before parameterized routes to avoid conflicts
 */

// Search posts (must come before /:id)
router.get(
  '/search',
  validate(searchPostsSchema),
  optionalAuth,
  postController.searchPosts.bind(postController)
)

// Get user's bookmarked posts (must come before /:id)
router.get('/bookmarks/me', authenticate, postController.getBookmarkedPosts.bind(postController))

// Get all posts with pagination and filters
router.get(
  '/',
  validate(getPostsSchema),
  optionalAuth,
  postController.listPosts.bind(postController)
)

// Get a single post
router.get(
  '/:id',
  validate(postIdSchema),
  optionalAuth,
  postController.getPost.bind(postController)
)

// Get comments for a post
router.get(
  '/:id/comments',
  validate(postIdSchema),
  validate(getCommentsSchema),
  postController.getComments.bind(postController)
)

/**
 * Protected routes (require authentication)
 */

// Create a new post
router.post(
  '/',
  authenticate,
  validate(createPostSchema),
  postController.createPost.bind(postController)
)

// Like a post
router.post(
  '/:id/like',
  authenticate,
  validate(postIdSchema),
  postController.likePost.bind(postController)
)

// Unlike a post
router.delete(
  '/:id/like',
  authenticate,
  validate(postIdSchema),
  postController.unlikePost.bind(postController)
)

// Bookmark a post
router.post(
  '/:id/bookmark',
  authenticate,
  validate(postIdSchema),
  postController.bookmarkPost.bind(postController)
)

// Unbookmark a post
router.delete(
  '/:id/bookmark',
  authenticate,
  validate(postIdSchema),
  postController.unbookmarkPost.bind(postController)
)

// Add a comment to a post
router.post(
  '/:id/comments',
  authenticate,
  validate(postIdSchema),
  validate(createCommentSchema),
  postController.addComment.bind(postController)
)

export default router
