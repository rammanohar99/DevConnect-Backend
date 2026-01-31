import mongoose, { Schema, Document, Types } from 'mongoose'

export interface IChat extends Document {
  _id: Types.ObjectId
  type: 'direct' | 'group'
  name?: string
  participants: Types.ObjectId[]
  lastMessage?: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const chatSchema = new Schema<IChat>(
  {
    type: {
      type: String,
      enum: ['direct', 'group'],
      required: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      maxlength: 100,
      // Required for group chats, optional for direct chats
      validate: {
        validator: function (this: IChat, value: string | undefined) {
          if (this.type === 'group') {
            return !!value && value.length > 0
          }
          return true
        },
        message: 'Group chats must have a name',
      },
    },
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      required: true,
      validate: {
        validator: function (value: Types.ObjectId[]) {
          return value.length >= 2
        },
        message: 'Chat must have at least 2 participants',
      },
      index: true,
    },
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
  },
  {
    timestamps: true,
  }
)

// Compound index for efficient participant queries
chatSchema.index({ participants: 1, updatedAt: -1 })

// Index for finding direct chats between two users
chatSchema.index({ type: 1, participants: 1 })

// Ensure direct chats have exactly 2 participants
chatSchema.pre('save', function (next) {
  if (this.type === 'direct' && this.participants.length !== 2) {
    return next(new Error('Direct chats must have exactly 2 participants'))
  }
  next()
})

export const Chat = mongoose.model<IChat>('Chat', chatSchema)
