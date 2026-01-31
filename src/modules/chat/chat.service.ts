import { Types } from 'mongoose'
import { Chat } from './chat.model'
import { Message } from './message.model'
import {
  CreateGroupChatDTO,
  SendMessageDTO,
  GetMessagesQuery,
  ChatResponse,
  MessageResponse,
  PaginatedMessages,
  GetChatsQuery,
  PaginatedChats,
} from './chat.types'
import { NotFoundError, ValidationError } from '../../shared/types/errors'
import logger from '../../shared/utils/logger'

/**
 * Send a message in a chat
 */
export const sendMessage = async (
  userId: string,
  data: SendMessageDTO
): Promise<MessageResponse> => {
  try {
    const { chatId, content } = data

    // Validate chat exists and user is a participant
    const chat = await Chat.findById(chatId)
    if (!chat) {
      throw new NotFoundError('Chat')
    }

    const userObjectId = new Types.ObjectId(userId)
    const isParticipant = chat.participants.some((p) => p.equals(userObjectId))

    if (!isParticipant) {
      throw new ValidationError('User is not a participant in this chat', [])
    }

    // Create message
    const message = await Message.create({
      chat: chatId,
      sender: userId,
      content: content.trim(),
      readBy: [userId], // Sender has read their own message
    })

    // Update chat's lastMessage
    chat.lastMessage = message._id
    await chat.save()

    // Populate sender info
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'username email profile.name profile.avatar')
      .lean()

    if (!populatedMessage) {
      throw new NotFoundError('Message')
    }

    logger.info('Message sent', {
      messageId: message._id.toString(),
      chatId,
      userId,
    })

    return formatMessageResponse(populatedMessage)
  } catch (error) {
    logger.error('Failed to send message', {
      userId,
      chatId: data.chatId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Create a group chat
 */
export const createGroupChat = async (
  creatorId: string,
  data: CreateGroupChatDTO
): Promise<ChatResponse> => {
  try {
    const { name, participantIds } = data

    // Validate participants
    if (participantIds.length < 1) {
      throw new ValidationError('Group chat must have at least one other participant', [])
    }

    // Include creator in participants
    const allParticipants = [creatorId, ...participantIds]
    const uniqueParticipants = [...new Set(allParticipants)]

    if (uniqueParticipants.length < 2) {
      throw new ValidationError('Group chat must have at least 2 participants', [])
    }

    // Create chat
    const chat = await Chat.create({
      type: 'group',
      name: name.trim(),
      participants: uniqueParticipants,
    })

    // Populate participants
    const populatedChat = await Chat.findById(chat._id)
      .populate('participants', 'username email profile.name profile.avatar')
      .lean()

    if (!populatedChat) {
      throw new NotFoundError('Chat')
    }

    logger.info('Group chat created', {
      chatId: chat._id.toString(),
      creatorId,
      participantCount: uniqueParticipants.length,
    })

    return formatChatResponse(populatedChat)
  } catch (error) {
    logger.error('Failed to create group chat', {
      creatorId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Get or create a direct chat between two users
 */
export const getOrCreateDirectChat = async (
  userId1: string,
  userId2: string
): Promise<ChatResponse> => {
  try {
    if (userId1 === userId2) {
      throw new ValidationError('Cannot create chat with yourself', [])
    }

    // Check if direct chat already exists
    const existingChat = await Chat.findOne({
      type: 'direct',
      participants: { $all: [userId1, userId2], $size: 2 },
    })
      .populate('participants', 'username email profile.name profile.avatar')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'username email profile.name profile.avatar',
        },
      })
      .lean()

    if (existingChat) {
      logger.debug('Found existing direct chat', {
        chatId: existingChat._id.toString(),
        userId1,
        userId2,
      })
      return formatChatResponse(existingChat)
    }

    // Create new direct chat
    const chat = await Chat.create({
      type: 'direct',
      participants: [userId1, userId2],
    })

    const populatedChat = await Chat.findById(chat._id)
      .populate('participants', 'username email profile.name profile.avatar')
      .lean()

    if (!populatedChat) {
      throw new NotFoundError('Chat')
    }

    logger.info('Direct chat created', {
      chatId: chat._id.toString(),
      userId1,
      userId2,
    })

    return formatChatResponse(populatedChat)
  } catch (error) {
    logger.error('Failed to get or create direct chat', {
      userId1,
      userId2,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Get messages for a chat with pagination
 */
export const getMessages = async (
  userId: string,
  chatId: string,
  query: GetMessagesQuery
): Promise<PaginatedMessages> => {
  try {
    // Validate chat exists and user is a participant
    const chat = await Chat.findById(chatId)
    if (!chat) {
      throw new NotFoundError('Chat')
    }

    const userObjectId = new Types.ObjectId(userId)
    const isParticipant = chat.participants.some((p) => p.equals(userObjectId))

    if (!isParticipant) {
      throw new ValidationError('User is not a participant in this chat', [])
    }

    const page = Math.max(1, query.page || 1)
    const limit = Math.min(100, Math.max(1, query.limit || 50))
    const skip = (page - 1) * limit

    // Get messages in reverse chronological order
    const [messages, total] = await Promise.all([
      Message.find({ chat: chatId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('sender', 'username email profile.name profile.avatar')
        .lean(),
      Message.countDocuments({ chat: chatId }),
    ])

    // Reverse to show oldest first in the page
    const messagesInOrder = messages.reverse()

    logger.debug('Retrieved messages', {
      chatId,
      userId,
      page,
      limit,
      total,
    })

    return {
      messages: messagesInOrder.map(formatMessageResponse),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  } catch (error) {
    logger.error('Failed to get messages', {
      userId,
      chatId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Mark messages as read by a user
 */
export const markAsRead = async (userId: string, chatId: string): Promise<void> => {
  try {
    // Validate chat exists and user is a participant
    const chat = await Chat.findById(chatId)
    if (!chat) {
      throw new NotFoundError('Chat')
    }

    const userObjectId = new Types.ObjectId(userId)
    const isParticipant = chat.participants.some((p) => p.equals(userObjectId))

    if (!isParticipant) {
      throw new ValidationError('User is not a participant in this chat', [])
    }

    // Update all messages in the chat that haven't been read by this user
    const result = await Message.updateMany(
      {
        chat: chatId,
        readBy: { $ne: userObjectId },
      },
      {
        $addToSet: { readBy: userObjectId },
      }
    )

    logger.info('Messages marked as read', {
      chatId,
      userId,
      modifiedCount: result.modifiedCount,
    })
  } catch (error) {
    logger.error('Failed to mark messages as read', {
      userId,
      chatId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Get all chats for a user
 */
export const getChatsByUser = async (
  userId: string,
  query: GetChatsQuery
): Promise<PaginatedChats> => {
  try {
    const page = Math.max(1, query.page || 1)
    const limit = Math.min(100, Math.max(1, query.limit || 20))
    const skip = (page - 1) * limit

    const userObjectId = new Types.ObjectId(userId)

    // Get chats where user is a participant, sorted by most recent activity
    const [chats, total] = await Promise.all([
      Chat.find({ participants: userObjectId })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('participants', 'username email profile.name profile.avatar')
        .populate({
          path: 'lastMessage',
          populate: {
            path: 'sender',
            select: 'username email profile.name profile.avatar',
          },
        })
        .lean(),
      Chat.countDocuments({ participants: userObjectId }),
    ])

    logger.debug('Retrieved user chats', {
      userId,
      page,
      limit,
      total,
    })

    return {
      chats: chats.map(formatChatResponse),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  } catch (error) {
    logger.error('Failed to get user chats', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Get a specific chat by ID
 */
export const getChatById = async (userId: string, chatId: string): Promise<ChatResponse> => {
  try {
    const chat = await Chat.findById(chatId)
      .populate('participants', 'username email profile.name profile.avatar')
      .populate({
        path: 'lastMessage',
        populate: {
          path: 'sender',
          select: 'username email profile.name profile.avatar',
        },
      })
      .lean()

    if (!chat) {
      throw new NotFoundError('Chat')
    }

    // Verify user is a participant
    const userObjectId = new Types.ObjectId(userId)
    const isParticipant = chat.participants.some((p: any) => p._id.equals(userObjectId))

    if (!isParticipant) {
      throw new ValidationError('User is not a participant in this chat', [])
    }

    logger.debug('Retrieved chat', {
      chatId,
      userId,
    })

    return formatChatResponse(chat)
  } catch (error) {
    logger.error('Failed to get chat', {
      userId,
      chatId,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    throw error
  }
}

/**
 * Format message response
 */
function formatMessageResponse(message: any): MessageResponse {
  return {
    _id: message._id.toString(),
    chat: message.chat.toString(),
    sender: {
      _id: message.sender._id.toString(),
      username: message.sender.username,
      email: message.sender.email,
      avatar: message.sender.profile?.avatar,
      profile: {
        name: message.sender.profile?.name || message.sender.username,
        avatar: message.sender.profile?.avatar,
      },
    },
    content: message.content,
    readBy: message.readBy.map((id: Types.ObjectId) => id.toString()),
    createdAt: message.createdAt,
  }
}

/**
 * Format chat response
 */
function formatChatResponse(chat: any): ChatResponse {
  const response: ChatResponse = {
    _id: chat._id.toString(),
    type: chat.type,
    participants: chat.participants.map((p: any) => ({
      _id: p._id.toString(),
      username: p.username,
      email: p.email,
      avatar: p.profile?.avatar,
      profile: {
        name: p.profile?.name || p.username,
        avatar: p.profile?.avatar,
      },
    })),
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  }

  if (chat.name) {
    response.name = chat.name
  }

  if (chat.lastMessage) {
    response.lastMessage = {
      _id: chat.lastMessage._id.toString(),
      chat: chat.lastMessage.chat.toString(),
      sender: {
        _id: chat.lastMessage.sender._id.toString(),
        username: chat.lastMessage.sender.username,
        email: chat.lastMessage.sender.email,
        avatar: chat.lastMessage.sender.profile?.avatar,
        profile: {
          name: chat.lastMessage.sender.profile?.name || chat.lastMessage.sender.username,
          avatar: chat.lastMessage.sender.profile?.avatar,
        },
      },
      content: chat.lastMessage.content,
      readBy: chat.lastMessage.readBy.map((id: Types.ObjectId) => id.toString()),
      createdAt: chat.lastMessage.createdAt,
    }
  }

  return response
}
