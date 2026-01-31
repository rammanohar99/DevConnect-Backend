import { z } from 'zod'

export const createPostSchema = z.object({
  body: z.object({
    title: z
      .string()
      .min(3, 'Title must be at least 3 characters long')
      .max(200, 'Title must not exceed 200 characters')
      .trim(),
    content: z
      .string()
      .min(10, 'Content must be at least 10 characters long')
      .max(50000, 'Content must not exceed 50000 characters')
      .trim(),
    tags: z
      .array(z.string().trim())
      .max(10, 'Cannot have more than 10 tags')
      .optional()
      .default([]),
    status: z.enum(['draft', 'published', 'archived']).optional().default('published'),
  }),
})

export const updatePostSchema = z.object({
  body: z.object({
    title: z
      .string()
      .min(3, 'Title must be at least 3 characters long')
      .max(200, 'Title must not exceed 200 characters')
      .trim()
      .optional(),
    content: z
      .string()
      .min(10, 'Content must be at least 10 characters long')
      .max(50000, 'Content must not exceed 50000 characters')
      .trim()
      .optional(),
    tags: z.array(z.string().trim()).max(10, 'Cannot have more than 10 tags').optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
  }),
})

export const getPostsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .refine((val) => val <= 100, 'Limit cannot exceed 100')
      .optional()
      .default('10'),
    author: z.string().optional(),
    tags: z
      .string()
      .transform((val) => val.split(',').map((tag) => tag.trim()))
      .optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
  }),
})

export const searchPostsSchema = z.object({
  query: z.object({
    q: z.string().min(1, 'Search query is required').trim(),
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .refine((val) => val <= 100, 'Limit cannot exceed 100')
      .optional()
      .default('10'),
    tags: z
      .string()
      .transform((val) => val.split(',').map((tag) => tag.trim()))
      .optional(),
    sortBy: z.enum(['date', 'popularity', 'relevance']).optional().default('relevance'),
  }),
})

export const createCommentSchema = z.object({
  body: z.object({
    content: z
      .string()
      .min(1, 'Content must be at least 1 character long')
      .max(10000, 'Content must not exceed 10000 characters')
      .trim(),
    parentComment: z.string().optional(),
  }),
})

export const getCommentsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .refine((val) => val <= 100, 'Limit cannot exceed 100')
      .optional()
      .default('20'),
  }),
})

export const postIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Post ID is required'),
  }),
})
