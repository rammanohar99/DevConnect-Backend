import { z } from 'zod'

export const createGroupChatSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(1, 'Group name is required')
      .max(100, 'Group name must be at most 100 characters'),
    participantIds: z
      .array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid participant ID'))
      .min(1, 'At least one participant is required')
      .max(50, 'Maximum 50 participants allowed'),
  }),
})

export const getMessagesSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid chat ID'),
  }),
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 50)),
  }),
})

export const markAsReadSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid chat ID'),
  }),
})

export const getChatsSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20)),
  }),
})

export const getChatByIdSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid chat ID'),
  }),
})

export const createDirectChatSchema = z.object({
  body: z.object({
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID'),
  }),
})
