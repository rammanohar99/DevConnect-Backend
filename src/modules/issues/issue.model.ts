import mongoose, { Document, Schema } from 'mongoose'

export type IssueStatus = 'open' | 'in-progress' | 'closed'
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical'

export interface IIssue extends Document {
  creator: mongoose.Types.ObjectId
  title: string
  description: string
  status: IssueStatus
  priority: IssuePriority
  labels: string[]
  assignees: mongoose.Types.ObjectId[]
  commentCount: number
  createdAt: Date
  updatedAt: Date
  closedAt?: Date
  canTransitionTo(newStatus: IssueStatus): boolean
}

const issueSchema = new Schema<IIssue>(
  {
    creator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters long'],
      maxlength: [200, 'Title must not exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters long'],
      maxlength: [10000, 'Description must not exceed 10000 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['open', 'in-progress', 'closed'],
        message: '{VALUE} is not a valid status',
      },
      default: 'open',
      index: true,
    },
    priority: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high', 'critical'],
        message: '{VALUE} is not a valid priority',
      },
      default: 'medium',
    },
    labels: {
      type: [String],
      default: [],
      index: true,
    },
    assignees: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
      index: true,
    },
    commentCount: {
      type: Number,
      default: 0,
      min: [0, 'Comment count cannot be negative'],
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (_doc, ret: any) {
        delete ret.__v
        return ret
      },
    },
    toObject: {
      virtuals: true,
    },
  }
)

// Indexes for performance
issueSchema.index({ creator: 1, createdAt: -1 })
issueSchema.index({ assignees: 1, status: 1 })
issueSchema.index({ status: 1, createdAt: -1 })
issueSchema.index({ labels: 1, status: 1 })
issueSchema.index({ createdAt: -1 })

// Validation for status transitions
issueSchema.pre('save', function (next) {
  // If status is being changed to 'closed', set closedAt
  if (this.isModified('status') && this.status === 'closed' && !this.closedAt) {
    this.closedAt = new Date()
  }

  // If status is being changed from 'closed' to something else, clear closedAt
  if (this.isModified('status') && this.status !== 'closed' && this.closedAt) {
    this.closedAt = undefined
  }

  next()
})

// Method to validate status transitions
issueSchema.methods.canTransitionTo = function (this: IIssue, newStatus: IssueStatus): boolean {
  const validTransitions: Record<IssueStatus, IssueStatus[]> = {
    open: ['in-progress', 'closed'],
    'in-progress': ['open', 'closed'],
    closed: ['open'], // Can reopen
  }

  return validTransitions[this.status as IssueStatus]?.includes(newStatus) || false
}

export const Issue = mongoose.model<IIssue>('Issue', issueSchema)
