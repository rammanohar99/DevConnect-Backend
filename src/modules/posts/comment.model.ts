import mongoose, { Document, Schema } from 'mongoose'

export interface IComment extends Document {
  author: mongoose.Types.ObjectId
  post?: mongoose.Types.ObjectId
  issue?: mongoose.Types.ObjectId
  content: string
  likes: mongoose.Types.ObjectId[]
  parentComment?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
  likeCount: number
}

const commentSchema = new Schema<IComment>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
      index: true,
    },
    post: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      index: true,
    },
    issue: {
      type: Schema.Types.ObjectId,
      ref: 'Issue',
      index: true,
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
      minlength: [1, 'Content must be at least 1 character long'],
      maxlength: [10000, 'Content must not exceed 10000 characters'],
    },
    likes: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
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
commentSchema.index({ author: 1, createdAt: -1 })
commentSchema.index({ post: 1, createdAt: -1 })
commentSchema.index({ issue: 1, createdAt: -1 })
commentSchema.index({ createdAt: -1 })
commentSchema.index({ parentComment: 1 })

// Validation: Comment must belong to either a post or an issue, but not both
commentSchema.pre('validate', function (next) {
  if (!this.post && !this.issue) {
    next(new Error('Comment must belong to either a post or an issue'))
  } else if (this.post && this.issue) {
    next(new Error('Comment cannot belong to both a post and an issue'))
  } else {
    next()
  }
})

// Virtual field for computed properties
commentSchema.virtual('likeCount').get(function () {
  return this.likes?.length || 0
})

export const Comment = mongoose.model<IComment>('Comment', commentSchema)
