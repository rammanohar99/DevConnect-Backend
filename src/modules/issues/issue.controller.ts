import { Request, Response, NextFunction } from 'express'
import { issueService } from './issue.service'

export class IssueController {
  /**
   * Create a new issue
   * POST /api/v1/issues
   */
  async createIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId
      const issue = await issueService.createIssue(userId, req.body)

      // Populate creator and assignees
      await issue.populate('creator', 'username profile.name profile.avatar')
      await issue.populate('assignees', 'username profile.name profile.avatar')

      res.status(201).json({
        status: 'success',
        data: { issue },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get issue by ID
   * GET /api/v1/issues/:id
   */
  async getIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const issue = await issueService.getIssueById(req.params.id)

      res.status(200).json({
        status: 'success',
        data: { issue },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get issues with filters
   * GET /api/v1/issues
   */
  async getIssues(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = {
        status: req.query.status as any,
        labels: req.query.labels as any,
        assignee: req.query.assignee as string,
        creator: req.query.creator as string,
        priority: req.query.priority as any,
      }

      const issues = await issueService.filterIssues(filters)

      res.status(200).json({
        status: 'success',
        data: { issues, count: issues.length },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Update issue status
   * PATCH /api/v1/issues/:id/status
   */
  async updateIssueStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const issue = await issueService.updateIssueStatus(req.params.id, {
        status: req.body.status,
      })

      // Populate creator and assignees
      await issue.populate('creator', 'username profile.name profile.avatar')
      await issue.populate('assignees', 'username profile.name profile.avatar')

      res.status(200).json({
        status: 'success',
        data: { issue },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Assign issue to a user
   * POST /api/v1/issues/:id/assign
   */
  async assignIssue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const issue = await issueService.assignIssue(req.params.id, {
        assigneeId: req.body.assigneeId,
      })

      // Populate creator
      await issue.populate('creator', 'username profile.name profile.avatar')

      res.status(200).json({
        status: 'success',
        data: { issue },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Add label to issue
   * POST /api/v1/issues/:id/labels
   */
  async addLabel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const issue = await issueService.addLabel(req.params.id, {
        label: req.body.label,
      })

      // Populate creator and assignees
      await issue.populate('creator', 'username profile.name profile.avatar')
      await issue.populate('assignees', 'username profile.name profile.avatar')

      res.status(200).json({
        status: 'success',
        data: { issue },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Remove label from issue
   * DELETE /api/v1/issues/:id/labels/:label
   */
  async removeLabel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const issue = await issueService.removeLabel(req.params.id, {
        label: req.params.label,
      })

      // Populate creator and assignees
      await issue.populate('creator', 'username profile.name profile.avatar')
      await issue.populate('assignees', 'username profile.name profile.avatar')

      res.status(200).json({
        status: 'success',
        data: { issue },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Add comment to issue
   * POST /api/v1/issues/:id/comments
   */
  async addComment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId
      const comment = await issueService.addComment(req.params.id, userId, {
        content: req.body.content,
      })

      res.status(201).json({
        status: 'success',
        data: { comment },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get comments for an issue
   * GET /api/v1/issues/:id/comments
   */
  async getComments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const comments = await issueService.getIssueComments(req.params.id)

      res.status(200).json({
        status: 'success',
        data: { comments, count: comments.length },
      })
    } catch (error) {
      next(error)
    }
  }
}

export const issueController = new IssueController()
