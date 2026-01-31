import mongoose, { Schema, Document } from 'mongoose'

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId
  type: 'like' | 'comment' | 'mention' | 'issue_assigned' | 'message'
  actor: mongoose.Types.ObjectId
  resource?: {
    type: 'post' | 'issue' | 'comment' | 'message'
    id: mongoose.Types.ObjectId
  }
  message: string
  isRead: boolean
  createdAt: Date
  updatedAt: Date
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['like', 'comment', 'mention', 'issue_assigned', 'message'],
      required: true,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    resource: {
      type: {
        type: String,
        enum: ['post', 'issue', 'comment', 'message'],
      },
      id: {
        type: Schema.Types.ObjectId,
      },
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

// Compound index for efficient querying of user's notifications
notificationSchema.index({ recipient: 1, createdAt: -1 })
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 })

export const Notification = mongoose.model<INotification>('Notification', notificationSchema)
