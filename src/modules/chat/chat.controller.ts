import { Request, Response, NextFunction } from 'express'
import {
  createGroupChat,
  getOrCreateDirectChat,
  getMessages,
  markAsRead,
  getChatsByUser,
  getChatById,
} from './chat.service'
import logger from '../../shared/utils/logger'

/**
 * Create a group chat
 * POST /api/v1/chats
 */
export const createGroupChatHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const { name, participantIds } = req.body

    const chat = await createGroupChat(userId, { name, participantIds })

    logger.info('Group chat created via REST', {
      chatId: chat._id,
      userId,
      participantCount: chat.participants.length,
    })

    res.status(201).json({
      status: 'success',
      data: { chat },
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Create or get a direct chat with another user
 * POST /api/v1/chats/direct
 */
export const createDirectChatHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const { userId: otherUserId } = req.body

    const chat = await getOrCreateDirectChat(userId, otherUserId)

    logger.info('Direct chat created/retrieved via REST', {
      chatId: chat._id,
      userId,
      otherUserId,
    })

    res.status(200).json({
      status: 'success',
      data: { chat },
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get messages for a chat
 * GET /api/v1/chats/:id/messages
 */
export const getMessagesHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const chatId = req.params.id
    const { page, limit } = req.query

    const result = await getMessages(userId, chatId, {
      page: page as number | undefined,
      limit: limit as number | undefined,
    })

    logger.debug('Messages retrieved via REST', {
      chatId,
      userId,
      page: result.pagination.page,
      total: result.pagination.total,
    })

    res.status(200).json({
      status: 'success',
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Mark messages in a chat as read
 * POST /api/v1/chats/:id/read
 */
export const markAsReadHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const chatId = req.params.id

    await markAsRead(userId, chatId)

    logger.info('Messages marked as read via REST', {
      chatId,
      userId,
    })

    res.status(200).json({
      status: 'success',
      message: 'Messages marked as read',
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get all chats for the authenticated user
 * GET /api/v1/chats
 */
export const getChatsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const { page, limit } = req.query

    const result = await getChatsByUser(userId, {
      page: page as number | undefined,
      limit: limit as number | undefined,
    })

    logger.debug('User chats retrieved via REST', {
      userId,
      page: result.pagination.page,
      total: result.pagination.total,
    })

    res.status(200).json({
      status: 'success',
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * Get a specific chat by ID
 * GET /api/v1/chats/:id
 */
export const getChatByIdHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user!.userId
    const chatId = req.params.id

    const chat = await getChatById(userId, chatId)

    logger.debug('Chat retrieved via REST', {
      chatId,
      userId,
    })

    res.status(200).json({
      status: 'success',
      data: { chat },
    })
  } catch (error) {
    next(error)
  }
}
