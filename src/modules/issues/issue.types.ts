import { IssueStatus, IssuePriority } from './issue.model'

export interface CreateIssueDTO {
  title: string
  description: string
  priority?: IssuePriority
  labels?: string[]
  assignees?: string[]
}

export interface UpdateIssueStatusDTO {
  status: IssueStatus
}

export interface AssignIssueDTO {
  assigneeId: string
}

export interface AddLabelDTO {
  label: string
}

export interface RemoveLabelDTO {
  label: string
}

export interface IssueFilters {
  status?: IssueStatus
  labels?: string[]
  assignee?: string
  creator?: string
  priority?: IssuePriority
}

export interface IssueResponse {
  _id: string
  creator: {
    _id: string
    username: string
    profile: {
      name: string
      avatar?: string
    }
  }
  title: string
  description: string
  status: IssueStatus
  priority: IssuePriority
  labels: string[]
  assignees: Array<{
    _id: string
    username: string
    profile: {
      name: string
      avatar?: string
    }
  }>
  commentCount: number
  createdAt: Date
  updatedAt: Date
  closedAt?: Date
}

export interface AddCommentDTO {
  content: string
}
