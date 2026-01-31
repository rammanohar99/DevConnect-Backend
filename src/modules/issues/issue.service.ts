import mongoose from 'mongoose'
import { Issue, IIssue } from './issue.model'
import { Comment } from '../posts/comment.model'
import {
  CreateIssueDTO,
  UpdateIssueStatusDTO,
  AssignIssueDTO,
  AddLabelDTO,
  RemoveLabelDTO,
  IssueFilters,
  AddCommentDTO,
} from './issue.types'
import { NotFoundError, ValidationError } from '../../shared/types/errors'
import { notificationService } from '../notifications/notification.service'
import logger from '../../shared/utils/logger'

export class IssueService {
  /**
   * Create a new issue
   */
  async createIssue(userId: string, data: CreateIssueDTO): Promise<IIssue> {
    const issue = new Issue({
      creator: userId,
      title: data.title,
      description: data.description,
      priority: data.priority || 'medium',
      labels: data.labels || [],
      assignees: data.assignees || [],
      status: 'open', // Initial status is always 'open'
    })

    await issue.save()
    return issue
  }

  /**
   * Get issue by ID
   */
  async getIssueById(issueId: string): Promise<IIssue> {
    if (!mongoose.Types.ObjectId.isValid(issueId)) {
      throw new ValidationError('Invalid issue ID', [
        { field: 'issueId', message: 'Invalid issue ID format' },
      ])
    }

    const issue = await Issue.findById(issueId)
      .populate('creator', 'username profile.name profile.avatar')
      .populate('assignees', 'username profile.name profile.avatar')

    if (!issue) {
      throw new NotFoundError('Issue')
    }

    return issue
  }

  /**
   * Update issue status with validation
   */
  async updateIssueStatus(issueId: string, data: UpdateIssueStatusDTO): Promise<IIssue> {
    const issue = await this.getIssueById(issueId)

    // Validate status transition
    if (!issue.canTransitionTo(data.status)) {
      throw new ValidationError(
        `Invalid status transition from ${issue.status} to ${data.status}`,
        [
          {
            field: 'status',
            message: `Cannot transition from ${issue.status} to ${data.status}`,
          },
        ]
      )
    }

    issue.status = data.status
    await issue.save()

    return issue
  }

  /**
   * Assign issue to a user
   */
  async assignIssue(issueId: string, data: AssignIssueDTO): Promise<IIssue> {
    if (!mongoose.Types.ObjectId.isValid(data.assigneeId)) {
      throw new ValidationError('Invalid assignee ID', [
        { field: 'assigneeId', message: 'Invalid assignee ID format' },
      ])
    }

    const issue = await this.getIssueById(issueId)

    // Check if user is already assigned
    const assigneeObjectId = new mongoose.Types.ObjectId(data.assigneeId)
    const isAlreadyAssigned = issue.assignees.some((assignee) => assignee.equals(assigneeObjectId))

    if (!isAlreadyAssigned) {
      issue.assignees.push(assigneeObjectId)
      await issue.save()

      // Create notification for assignee (async, don't await)
      this.createAssignmentNotification(data.assigneeId, issueId, issue.title).catch((error) => {
        logger.error('Error creating assignment notification:', error)
      })
    }

    // Populate assignees before returning
    await issue.populate('assignees', 'username profile.name profile.avatar')

    return issue
  }

  /**
   * Add label to issue
   */
  async addLabel(issueId: string, data: AddLabelDTO): Promise<IIssue> {
    const issue = await this.getIssueById(issueId)

    // Check if label already exists
    if (!issue.labels.includes(data.label)) {
      issue.labels.push(data.label)
      await issue.save()
    }

    return issue
  }

  /**
   * Remove label from issue
   */
  async removeLabel(issueId: string, data: RemoveLabelDTO): Promise<IIssue> {
    const issue = await this.getIssueById(issueId)

    issue.labels = issue.labels.filter((label) => label !== data.label)
    await issue.save()

    return issue
  }

  /**
   * Filter issues with multiple criteria
   */
  async filterIssues(filters: IssueFilters): Promise<IIssue[]> {
    const query: any = {}

    if (filters.status) {
      query.status = filters.status
    }

    if (filters.labels && filters.labels.length > 0) {
      query.labels = { $in: filters.labels }
    }

    if (filters.assignee) {
      if (!mongoose.Types.ObjectId.isValid(filters.assignee)) {
        throw new ValidationError('Invalid assignee ID', [
          { field: 'assignee', message: 'Invalid assignee ID format' },
        ])
      }
      query.assignees = new mongoose.Types.ObjectId(filters.assignee)
    }

    if (filters.creator) {
      if (!mongoose.Types.ObjectId.isValid(filters.creator)) {
        throw new ValidationError('Invalid creator ID', [
          { field: 'creator', message: 'Invalid creator ID format' },
        ])
      }
      query.creator = new mongoose.Types.ObjectId(filters.creator)
    }

    if (filters.priority) {
      query.priority = filters.priority
    }

    const issues = await Issue.find(query)
      .populate('creator', 'username profile.name profile.avatar')
      .populate('assignees', 'username profile.name profile.avatar')
      .sort({ createdAt: -1 })

    return issues
  }

  /**
   * Add comment to issue
   */
  async addComment(issueId: string, userId: string, data: AddCommentDTO): Promise<any> {
    // Verify issue exists
    const issue = await this.getIssueById(issueId)

    // Create comment
    const comment = new Comment({
      author: userId,
      issue: issueId,
      content: data.content,
    })

    await comment.save()

    // Increment comment count
    issue.commentCount += 1
    await issue.save()

    // Populate author before returning
    await comment.populate('author', 'username profile.name profile.avatar')

    // Create notification for issue creator (async, don't await)
    this.createCommentNotification(issue.creator.toString(), userId, issueId, issue.title).catch(
      (error) => {
        logger.error('Error creating comment notification:', error)
      }
    )

    // Parse and create mention notifications (async, don't await)
    this.createMentionNotifications(data.content, userId, issueId, issue.title).catch((error) => {
      logger.error('Error creating mention notifications:', error)
    })

    return comment
  }

  /**
   * Get comments for an issue
   */
  async getIssueComments(issueId: string): Promise<any[]> {
    // Verify issue exists
    await this.getIssueById(issueId)

    const comments = await Comment.find({ issue: issueId })
      .populate('author', 'username profile.name profile.avatar')
      .sort({ createdAt: -1 })

    return comments
  }

  /**
   * Create a notification for issue assignment
   * Called asynchronously, errors are logged but don't break the flow
   */
  private async createAssignmentNotification(
    assigneeId: string,
    issueId: string,
    issueTitle: string
  ): Promise<void> {
    await notificationService.createNotification({
      recipientId: assigneeId,
      type: 'issue_assigned',
      actorId: assigneeId, // In this case, the actor is the system/assigner
      message: `You were assigned to issue "${issueTitle}"`,
      resource: {
        type: 'issue',
        id: issueId,
      },
    })
  }

  /**
   * Create a notification for issue comment
   * Called asynchronously, errors are logged but don't break the flow
   */
  private async createCommentNotification(
    issueCreatorId: string,
    commenterId: string,
    issueId: string,
    issueTitle: string
  ): Promise<void> {
    await notificationService.createNotification({
      recipientId: issueCreatorId,
      type: 'comment',
      actorId: commenterId,
      message: `commented on your issue "${issueTitle}"`,
      resource: {
        type: 'issue',
        id: issueId,
      },
    })
  }

  /**
   * Parse content for @mentions and create notifications
   * Mentions format: @username
   */
  private async createMentionNotifications(
    content: string,
    mentionerId: string,
    issueId: string,
    issueTitle: string
  ): Promise<void> {
    // Extract mentions using regex: @username (alphanumeric and underscore)
    const mentionRegex = /@(\w+)/g
    const mentions = content.match(mentionRegex)

    if (!mentions || mentions.length === 0) {
      return
    }

    // Extract unique usernames (remove @ and deduplicate)
    const usernames = [...new Set(mentions.map((m) => m.substring(1)))]

    // Import User model dynamically to avoid circular dependencies
    const { User } = await import('../users/user.model')

    // Find users by username
    const users = await User.find({ username: { $in: usernames } })
      .select('_id username')
      .lean()

    // Create notification for each mentioned user
    for (const user of users) {
      await notificationService.createNotification({
        recipientId: user._id.toString(),
        type: 'mention',
        actorId: mentionerId,
        message: `mentioned you in issue "${issueTitle}"`,
        resource: {
          type: 'issue',
          id: issueId,
        },
      })
    }
  }
}

export const issueService = new IssueService()
