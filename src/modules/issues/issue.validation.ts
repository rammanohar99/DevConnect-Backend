import { z } from 'zod'

export const createIssueSchema = z.object({
  body: z.object({
    title: z
      .string()
      .min(3, 'Title must be at least 3 characters long')
      .max(200, 'Title must not exceed 200 characters')
      .trim(),
    description: z
      .string()
      .min(10, 'Description must be at least 10 characters long')
      .max(10000, 'Description must not exceed 10000 characters')
      .trim(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
    labels: z.array(z.string()).optional().default([]),
    assignees: z.array(z.string()).optional().default([]),
  }),
})

export const updateIssueStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Issue ID is required'),
  }),
  body: z.object({
    status: z.enum(['open', 'in-progress', 'closed'], {
      errorMap: () => ({
        message: 'Status must be one of: open, in-progress, closed',
      }),
    }),
  }),
})

export const assignIssueSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Issue ID is required'),
  }),
  body: z.object({
    assigneeId: z.string().min(1, 'Assignee ID is required'),
  }),
})

export const addLabelSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Issue ID is required'),
  }),
  body: z.object({
    label: z
      .string()
      .min(1, 'Label must be at least 1 character long')
      .max(50, 'Label must not exceed 50 characters')
      .trim(),
  }),
})

export const removeLabelSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Issue ID is required'),
    label: z.string().min(1, 'Label is required'),
  }),
})

export const getIssueSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Issue ID is required'),
  }),
})

export const filterIssuesSchema = z.object({
  query: z.object({
    status: z.enum(['open', 'in-progress', 'closed']).optional(),
    labels: z
      .string()
      .optional()
      .transform((val) => (val ? val.split(',') : undefined)),
    assignee: z.string().optional(),
    creator: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  }),
})

export const addCommentSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Issue ID is required'),
  }),
  body: z.object({
    content: z
      .string()
      .min(1, 'Content must be at least 1 character long')
      .max(10000, 'Content must not exceed 10000 characters')
      .trim(),
  }),
})
