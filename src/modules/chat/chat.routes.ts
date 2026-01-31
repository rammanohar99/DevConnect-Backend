import { Router } from 'express'
import {
  createGroupChatHandler,
  createDirectChatHandler,
  getMessagesHandler,
  markAsReadHandler,
  getChatsHandler,
  getChatByIdHandler,
} from './chat.controller'
import { authenticate } from '../../shared/middleware/auth.middleware'
import { validate } from '../../shared/middleware/validation.middleware'
import {
  createGroupChatSchema,
  createDirectChatSchema,
  getMessagesSchema,
  markAsReadSchema,
  getChatsSchema,
  getChatByIdSchema,
} from './chat.validation'

const router = Router()

// All chat routes require authentication
router.use(authenticate)

// Create a group chat
router.post('/', validate(createGroupChatSchema), createGroupChatHandler)

// Create or get a direct chat
router.post('/direct', validate(createDirectChatSchema), createDirectChatHandler)

// Get all chats for the authenticated user
router.get('/', validate(getChatsSchema), getChatsHandler)

// Get a specific chat by ID
router.get('/:id', validate(getChatByIdSchema), getChatByIdHandler)

// Get messages for a chat
router.get('/:id/messages', validate(getMessagesSchema), getMessagesHandler)

// Mark messages in a chat as read
router.post('/:id/read', validate(markAsReadSchema), markAsReadHandler)

export default router
