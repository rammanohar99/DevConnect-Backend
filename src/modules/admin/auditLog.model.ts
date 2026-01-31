import mongoose, { Document, Schema } from 'mongoose'

export interface IAuditLog extends Document {
  adminId: mongoose.Types.ObjectId
  action: string
  targetType: 'user' | 'post' | 'comment' | 'issue'
  targetId: mongoose.Types.ObjectId
  details: Record<string, any>
  timestamp: Date
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Admin ID is required'],
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
      index: true,
    },
    targetType: {
      type: String,
      enum: ['user', 'post', 'comment', 'issue'],
      required: [true, 'Target type is required'],
      index: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: [true, 'Target ID is required'],
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    toJSON: {
      transform: function (_doc, ret: any) {
        delete ret.__v
        return ret
      },
    },
  }
)

// Indexes for performance
auditLogSchema.index({ adminId: 1, timestamp: -1 })
auditLogSchema.index({ targetType: 1, targetId: 1 })
auditLogSchema.index({ timestamp: -1 })

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema)
