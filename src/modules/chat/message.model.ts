import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IMessage extends Document {
  _id: Types.ObjectId
  chat: Types.ObjectId
  sender: Types.ObjectId
  content: string
  readBy: Types.ObjectId[]
  createdAt: Date
}

const messageSchema = new Schema<IMessage>(
  {
    chat: {
      type: Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    readBy: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
  },
  {
    timestamps: true,
  }
)

// Compound index for efficient chat message queries with pagination
messageSchema.index({ chat: 1, createdAt: -1 })

// Index for finding unread messages
messageSchema.index({ chat: 1, readBy: 1 })

// Automatically add sender to readBy array on creation
messageSchema.pre('save', function (next) {
  if (this.isNew && !this.readBy.includes(this.sender)) {
    this.readBy.push(this.sender)
  }
  next()
})

export const Message = mongoose.model<IMessage>('Message', messageSchema)
