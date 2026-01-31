import { ObjectId } from 'mongoose'

export interface GetUserListDTO {
  page?: number
  limit?: number
  role?: 'user' | 'moderator' | 'admin'
  search?: string
}

export interface UpdateUserRoleDTO {
  role: 'user' | 'moderator' | 'admin'
}

export interface HideContentDTO {
  contentType: 'post' | 'comment'
  contentId: string
  reason?: string
}

export interface SystemMetrics {
  userCount: number
  postCount: number
  activeUsers: number
  issueCount: number
  commentCount: number
  timestamp: Date
}

export interface AuditLogEntry {
  _id?: ObjectId
  adminId: ObjectId
  action: string
  targetType: 'user' | 'post' | 'comment' | 'issue'
  targetId: ObjectId
  details: Record<string, any>
  timestamp: Date
}

export interface PaginatedUsers {
  users: any[]
  total: number
  page: number
  limit: number
  totalPages: number
}
