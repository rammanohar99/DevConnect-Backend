import * as fc from 'fast-check'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { PostService } from '../post.service'
import { Post } from '../post.model'
import { User } from '../../users/user.model'
import { CreatePostDTO, PostFilters, Pagination } from '../post.types'

describe('Post Service Property Tests', () => {
  let mongoServer: MongoMemoryServer
  let postService: PostService

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()
    await mongoose.connect(mongoUri)
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  beforeEach(async () => {
    await Post.deleteMany({})
    await User.deleteMany({})
    postService = new PostService()
  })

  // Helper to create a test user
  const createTestUser = async () => {
    const user = await User.create({
      email: `test${Date.now()}@example.com`,
      username: `user${Date.now()}`,
      password: 'password123',
      profile: {
        name: 'Test User',
        skills: [],
        socialLinks: {},
      },
    })
    return user
  }

  // Feature: devconnect-pro-platform, Property 10: Post creation persists content
  describe('Property 10: Post creation persists content', () => {
    it('should persist post content with round-trip consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            title: fc.string({ minLength: 3, maxLength: 200 }).filter((s) => s.trim().length >= 3),
            content: fc
              .string({ minLength: 10, maxLength: 5000 })
              .filter((s) => s.trim().length >= 10),
            tags: fc.array(
              fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length >= 1),
              {
                minLength: 0,
                maxLength: 10,
              }
            ),
            status: fc.constantFrom('draft' as const, 'published' as const, 'archived' as const),
          }),
          async (postData: CreatePostDTO) => {
            const user = await createTestUser()

            // Create post
            const createdPost = await postService.createPost(user._id.toString(), postData)

            // Verify post was created with correct data (trim for comparison since model trims)
            expect(createdPost.title).toBe(postData.title.trim())
            expect(createdPost.content).toBe(postData.content.trim())
            expect(createdPost.tags).toEqual(postData.tags)
            expect(createdPost.status).toBe(postData.status)
            expect(createdPost.author.toString()).toBe(user._id.toString())

            // Round-trip: retrieve post and verify data persisted
            const retrievedPost = await postService.getPost(createdPost._id.toString())
            expect(retrievedPost.title).toBe(postData.title.trim())
            expect(retrievedPost.content).toBe(postData.content.trim())
            expect(retrievedPost.tags).toEqual(postData.tags)
            expect(retrievedPost.status).toBe(postData.status)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should preserve markdown formatting in content', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 200 }).filter((s) => s.trim().length >= 3),
          fc.oneof(
            fc.constant('# Heading\n\n**Bold text**'),
            fc.constant('```javascript\nconst x = 1;\n```'),
            fc.constant('- Item 1\n- Item 2\n- Item 3'),
            fc.constant('[Link](https://example.com)'),
            fc.constant('> Blockquote\n\nNormal text')
          ),
          async (title, markdownContent) => {
            const user = await createTestUser()

            const postData: CreatePostDTO = {
              title,
              content: markdownContent,
              tags: [],
              status: 'published',
            }

            const createdPost = await postService.createPost(user._id.toString(), postData)
            const retrievedPost = await postService.getPost(createdPost._id.toString())

            // Markdown should be preserved exactly (model trims, so compare trimmed)
            expect(retrievedPost.content).toBe(markdownContent.trim())
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  // Feature: devconnect-pro-platform, Property 12: User interactions update collections correctly
  describe('Property 12: User interactions update collections correctly', () => {
    it('should handle likes idempotently and update counts correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 200 }).filter((s) => s.trim().length >= 3),
          fc.integer({ min: 1, max: 5 }),
          async (title, likeAttempts) => {
            const user = await createTestUser()
            const liker = await createTestUser()

            // Create post
            const post = await postService.createPost(user._id.toString(), {
              title,
              content: 'Test content for likes',
              tags: [],
              status: 'published',
            })

            // Like the post multiple times (should be idempotent)
            for (let i = 0; i < likeAttempts; i++) {
              await postService.likePost(post._id.toString(), liker._id.toString())
            }

            // Retrieve post and verify like count
            const updatedPost = await Post.findById(post._id)
            expect(updatedPost!.likes).toHaveLength(1)
            expect(updatedPost!.likes[0].toString()).toBe(liker._id.toString())
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle bookmarks idempotently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 200 }).filter((s) => s.trim().length >= 3),
          fc.integer({ min: 1, max: 5 }),
          async (title, bookmarkAttempts) => {
            const user = await createTestUser()
            const bookmarker = await createTestUser()

            // Create post
            const post = await postService.createPost(user._id.toString(), {
              title,
              content: 'Test content for bookmarks',
              tags: [],
              status: 'published',
            })

            // Bookmark the post multiple times (should be idempotent)
            for (let i = 0; i < bookmarkAttempts; i++) {
              await postService.bookmarkPost(post._id.toString(), bookmarker._id.toString())
            }

            // Retrieve post and verify bookmark count
            const updatedPost = await Post.findById(post._id)
            expect(updatedPost!.bookmarks).toHaveLength(1)
            expect(updatedPost!.bookmarks[0].toString()).toBe(bookmarker._id.toString())
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should increment comment count when comments are added', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 200 }).filter((s) => s.trim().length >= 3),
          fc.array(fc.string({ minLength: 1, maxLength: 500 }), { minLength: 1, maxLength: 10 }),
          async (title, commentContents) => {
            const user = await createTestUser()
            const commenter = await createTestUser()

            // Create post
            const post = await postService.createPost(user._id.toString(), {
              title,
              content: 'Test content for comments',
              tags: [],
              status: 'published',
            })

            // Add comments
            for (const content of commentContents) {
              await postService.addComment(post._id.toString(), commenter._id.toString(), {
                content,
              })
            }

            // Retrieve post and verify comment count
            const updatedPost = await Post.findById(post._id)
            expect(updatedPost!.commentCount).toBe(commentContents.length)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should allow unlike and unbookmark operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 200 }).filter((s) => s.trim().length >= 3),
          async (title) => {
            const user = await createTestUser()
            const interactor = await createTestUser()

            // Create post
            const post = await postService.createPost(user._id.toString(), {
              title,
              content: 'Test content for interactions',
              tags: [],
              status: 'published',
            })

            // Like and bookmark
            await postService.likePost(post._id.toString(), interactor._id.toString())
            await postService.bookmarkPost(post._id.toString(), interactor._id.toString())

            let updatedPost = await Post.findById(post._id)
            expect(updatedPost!.likes).toHaveLength(1)
            expect(updatedPost!.bookmarks).toHaveLength(1)

            // Unlike and unbookmark
            await postService.unlikePost(post._id.toString(), interactor._id.toString())
            await postService.unbookmarkPost(post._id.toString(), interactor._id.toString())

            updatedPost = await Post.findById(post._id)
            expect(updatedPost!.likes).toHaveLength(0)
            expect(updatedPost!.bookmarks).toHaveLength(0)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // Feature: devconnect-pro-platform, Property 13: Pagination returns correct page sizes
  describe('Property 13: Pagination returns correct page sizes', () => {
    it('should return at most N items per page', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 5, max: 20 }),
          fc.integer({ min: 1, max: 5 }),
          async (totalPosts, pageSize) => {
            const user = await createTestUser()

            // Create multiple posts
            for (let i = 0; i < totalPosts; i++) {
              await postService.createPost(user._id.toString(), {
                title: `Post ${i} title`,
                content: `Content ${i} with enough text`,
                tags: [],
                status: 'published',
              })
            }

            // Request first page
            const filters: PostFilters = { status: 'published' }
            const pagination: Pagination = { page: 1, limit: pageSize }
            const result = await postService.listPosts(filters, pagination)

            // Should return at most pageSize items
            expect(result.posts.length).toBeLessThanOrEqual(pageSize)
            expect(result.posts.length).toBe(Math.min(totalPosts, pageSize))
            expect(result.total).toBe(totalPosts)
            expect(result.page).toBe(1)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should return non-overlapping results across pages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 10, max: 30 }),
          fc.integer({ min: 3, max: 10 }),
          async (totalPosts, pageSize) => {
            const user = await createTestUser()

            // Create posts with unique titles
            const postTitles: string[] = []
            for (let i = 0; i < totalPosts; i++) {
              const title = `Post ${i}-${Date.now()}`
              postTitles.push(title)
              await postService.createPost(user._id.toString(), {
                title,
                content: `Content ${i} with enough text to pass validation`,
                tags: [],
                status: 'published',
              })
            }

            // Fetch all pages
            const filters: PostFilters = { status: 'published' }
            const allPostIds = new Set<string>()
            let page = 1
            let hasMore = true

            while (hasMore) {
              const result = await postService.listPosts(filters, { page, limit: pageSize })

              // Add post IDs to set
              result.posts.forEach((post) => {
                allPostIds.add(post._id.toString())
              })

              hasMore = result.hasMore
              page++

              // Safety check to prevent infinite loop
              if (page > 100) break
            }

            // All posts should be unique (no duplicates across pages)
            expect(allPostIds.size).toBe(totalPosts)
          }
        ),
        { numRuns: 30 }
      )
    })
  })

  // Feature: devconnect-pro-platform, Property 14: Search returns matching results
  describe('Property 14: Search returns matching results', () => {
    it('should filter posts by tags correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              title: fc
                .string({ minLength: 3, maxLength: 100 })
                .filter((s) => s.trim().length >= 3),
              tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
                minLength: 1,
                maxLength: 5,
              }),
            }),
            { minLength: 3, maxLength: 10 }
          ),
          async (postsData) => {
            const user = await createTestUser()

            // Create posts with different tags
            for (const postData of postsData) {
              await postService.createPost(user._id.toString(), {
                title: postData.title,
                content: 'Test content with enough text',
                tags: postData.tags,
                status: 'published',
              })
            }

            // Pick a random tag to filter by
            const allTags = postsData.flatMap((p) => p.tags)
            if (allTags.length === 0) return // Skip if no tags

            const filterTag = allTags[0]
            const expectedCount = postsData.filter((p) => p.tags.includes(filterTag)).length

            // Filter by tag
            const filters: PostFilters = { tags: [filterTag], status: 'published' }
            const result = await postService.listPosts(filters, { page: 1, limit: 100 })

            // All returned posts should have the filter tag
            result.posts.forEach((post) => {
              expect(post.tags).toContain(filterTag)
            })

            // Count should match expected
            expect(result.total).toBe(expectedCount)
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should filter posts by author correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }),
          fc.integer({ min: 2, max: 5 }),
          async (numUsers, postsPerUser) => {
            // Create multiple users
            const users = []
            for (let i = 0; i < numUsers; i++) {
              users.push(await createTestUser())
            }

            // Each user creates posts
            for (const user of users) {
              for (let i = 0; i < postsPerUser; i++) {
                await postService.createPost(user._id.toString(), {
                  title: `Post by ${user.username} - ${i}`,
                  content: 'Test content with enough text',
                  tags: [],
                  status: 'published',
                })
              }
            }

            // Filter by first user
            const targetUser = users[0]
            const filters: PostFilters = { author: targetUser._id.toString(), status: 'published' }
            const result = await postService.listPosts(filters, { page: 1, limit: 100 })

            // All returned posts should be by target user
            // Need to populate author or compare IDs directly
            result.posts.forEach((post) => {
              const authorId =
                typeof post.author === 'string' ? post.author : post.author.toString()
              expect(authorId).toBe(targetUser._id.toString())
            })

            // Count should match expected
            expect(result.total).toBe(postsPerUser)
          }
        ),
        { numRuns: 30 }
      )
    })
  })

  // Feature: devconnect-pro-platform, Property 15: Content sorting maintains order
  describe('Property 15: Content sorting maintains order', () => {
    it('should return posts sorted by creation date (newest first)', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 3, max: 10 }), async (numPosts) => {
          const user = await createTestUser()

          // Create posts with small delays to ensure different timestamps
          for (let i = 0; i < numPosts; i++) {
            await postService.createPost(user._id.toString(), {
              title: `Post ${i} title`,
              content: `Content ${i} with enough text to pass validation`,
              tags: [],
              status: 'published',
            })
            // Small delay to ensure different timestamps
            await new Promise((resolve) => setTimeout(resolve, 10))
          }

          // Fetch posts
          const result = await postService.listPosts(
            { status: 'published' },
            { page: 1, limit: 100 }
          )

          // Verify posts are sorted by createdAt descending (newest first)
          for (let i = 0; i < result.posts.length - 1; i++) {
            const currentDate = new Date(result.posts[i].createdAt).getTime()
            const nextDate = new Date(result.posts[i + 1].createdAt).getTime()
            expect(currentDate).toBeGreaterThanOrEqual(nextDate)
          }
        }),
        { numRuns: 50 }
      )
    })
  })
})
