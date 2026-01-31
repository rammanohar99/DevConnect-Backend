export interface CreateGroupChatDTO {
  name: string
  participantIds: string[]
}

export interface SendMessageDTO {
  chatId: string
  content: string
}

export interface GetMessagesQuery {
  page?: number
  limit?: number
}

export interface ChatResponse {
  _id: string
  type: 'direct' | 'group'
  name?: string
  participants: ParticipantInfo[]
  lastMessage?: MessageResponse
  createdAt: Date
  updatedAt: Date
}

export interface MessageResponse {
  _id: string
  chat: string
  sender: SenderInfo
  content: string
  readBy: string[]
  createdAt: Date
}

export interface ParticipantInfo {
  _id: string
  username: string
  email: string
  avatar?: string
  profile: {
    name: string
    avatar?: string
  }
}

export interface SenderInfo {
  _id: string
  username: string
  email: string
  avatar?: string
  profile: {
    name: string
    avatar?: string
  }
}

export interface PaginatedMessages {
  messages: MessageResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export interface GetChatsQuery {
  page?: number
  limit?: number
}

export interface PaginatedChats {
  chats: ChatResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}
