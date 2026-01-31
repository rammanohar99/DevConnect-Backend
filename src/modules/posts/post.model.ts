import mongoose, { Document, Schema } from 'mongoose'

export interface IPost extends Document {
  author: mongoose.Types.ObjectId
  title: string
  content: string
  tags: string[]
  likes: mongoose.Types.ObjectId[]
  bookmarks: mongoose.Types.ObjectId[]
  commentCount: number
  viewCount: number
  status: 'draft' | 'published' | 'archived'
  createdAt: Date
  updatedAt: Date
  likeCount: number
  bookmarkCount: number
}

const postSchema = new Schema<IPost>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters long'],
      maxlength: [200, 'Title must not exceed 200 characters'],
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
      minlength: [10, 'Content must be at least 10 characters long'],
      maxlength: [50000, 'Content must not exceed 50000 characters'],
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: function (tags: string[]) {
          return tags.length <= 10
        },
        message: 'Cannot have more than 10 tags',
      },
      index: true,
    },
    likes: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    bookmarks: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    commentCount: {
      type: Number,
      default: 0,
      min: [0, 'Comment count cannot be negative'],
    },
    viewCount: {
      type: Number,
      default: 0,
      min: [0, 'View count cannot be negative'],
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published',
      index: true,
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
postSchema.index({ author: 1, createdAt: -1 })
postSchema.index({ tags: 1, createdAt: -1 })
postSchema.index({ status: 1, createdAt: -1 })
postSchema.index({ createdAt: -1 })

// Text index for search functionality
postSchema.index({ title: 'text', content: 'text', tags: 'text' })

// Virtual fields for computed properties
postSchema.virtual('likeCount').get(function () {
  return this.likes?.length || 0
})

postSchema.virtual('bookmarkCount').get(function () {
  return this.bookmarks?.length || 0
})

export const Post = mongoose.model<IPost>('Post', postSchema)
