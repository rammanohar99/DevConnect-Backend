export type NotificationType = 'like' | 'comment' | 'mention' | 'issue_assigned' | 'message'

export type ResourceType = 'post' | 'issue' | 'comment' | 'message'

export interface CreateNotificationDTO {
  recipientId: string
  type: NotificationType
  actorId: string
  message: string
  resource?: {
    type: ResourceType
    id: string
  }
}

export interface NotificationFilters {
  isRead?: boolean
  type?: NotificationType
}

export interface NotificationResponse {
  _id: string
  recipient: string
  type: NotificationType
  actor: {
    _id: string
    username: string
    profile: {
      name: string
      avatar?: string
    }
  }
  resource?: {
    type: ResourceType
    id: string
  }
  message: string
  isRead: boolean
  createdAt: Date
  updatedAt: Date
}
