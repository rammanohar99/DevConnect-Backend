import { Router } from 'express'
import { issueController } from './issue.controller'
import { authenticate } from '../../shared/middleware/auth.middleware'
import { validate } from '../../shared/middleware/validation.middleware'
import {
  createIssueSchema,
  updateIssueStatusSchema,
  assignIssueSchema,
  addLabelSchema,
  removeLabelSchema,
  getIssueSchema,
  filterIssuesSchema,
  addCommentSchema,
} from './issue.validation'

const router = Router()

// All routes require authentication
router.use(authenticate)

// Create a new issue
router.post('/', validate(createIssueSchema), issueController.createIssue.bind(issueController))

// Get issues with filters
router.get('/', validate(filterIssuesSchema), issueController.getIssues.bind(issueController))

// Get issue by ID
router.get('/:id', validate(getIssueSchema), issueController.getIssue.bind(issueController))

// Update issue status
router.patch(
  '/:id/status',
  validate(updateIssueStatusSchema),
  issueController.updateIssueStatus.bind(issueController)
)

// Assign issue to a user
router.post(
  '/:id/assign',
  validate(assignIssueSchema),
  issueController.assignIssue.bind(issueController)
)

// Add label to issue
router.post('/:id/labels', validate(addLabelSchema), issueController.addLabel.bind(issueController))

// Remove label from issue
router.delete(
  '/:id/labels/:label',
  validate(removeLabelSchema),
  issueController.removeLabel.bind(issueController)
)

// Add comment to issue
router.post(
  '/:id/comments',
  validate(addCommentSchema),
  issueController.addComment.bind(issueController)
)

// Get comments for an issue
router.get(
  '/:id/comments',
  validate(getIssueSchema),
  issueController.getComments.bind(issueController)
)

export default router
