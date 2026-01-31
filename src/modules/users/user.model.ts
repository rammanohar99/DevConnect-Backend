import mongoose, { Document, Schema } from 'mongoose'
import bcrypt from 'bcrypt'

export interface IUser extends Document {
  email: string
  password: string
  username: string
  role: 'user' | 'moderator' | 'admin'
  profile: {
    name: string
    bio?: string
    avatar?: string
    skills: string[]
    socialLinks: {
      github?: string
      linkedin?: string
      twitter?: string
    }
  }
  notificationPreferences: {
    email: boolean
    push: boolean
    postComments: boolean
    issueUpdates: boolean
    chatMessages: boolean
  }
  isEmailVerified: boolean
  refreshTokens: string[]
  createdAt: Date
  updatedAt: Date
  comparePassword(candidatePassword: string): Promise<boolean>
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters long'],
      select: false, // Don't include password in queries by default
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters long'],
      maxlength: [20, 'Username must not exceed 20 characters'],
      match: [
        /^[a-zA-Z0-9_-]+$/,
        'Username can only contain letters, numbers, hyphens, and underscores',
      ],
    },
    role: {
      type: String,
      enum: ['user', 'moderator', 'admin'],
      default: 'user',
    },
    profile: {
      name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [100, 'Name must not exceed 100 characters'],
      },
      bio: {
        type: String,
        trim: true,
        maxlength: [500, 'Bio must not exceed 500 characters'],
      },
      avatar: {
        type: String,
        trim: true,
      },
      skills: {
        type: [String],
        default: [],
        validate: {
          validator: function (skills: string[]) {
            return skills.length <= 20
          },
          message: 'Cannot have more than 20 skills',
        },
      },
      socialLinks: {
        github: {
          type: String,
          trim: true,
        },
        linkedin: {
          type: String,
          trim: true,
        },
        twitter: {
          type: String,
          trim: true,
        },
      },
    },
    notificationPreferences: {
      email: {
        type: Boolean,
        default: true,
      },
      push: {
        type: Boolean,
        default: true,
      },
      postComments: {
        type: Boolean,
        default: true,
      },
      issueUpdates: {
        type: Boolean,
        default: true,
      },
      chatMessages: {
        type: Boolean,
        default: true,
      },
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    refreshTokens: {
      type: [String],
      default: [],
      select: false, // Don't include refresh tokens in queries by default
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret: any) {
        delete ret.password
        delete ret.refreshTokens
        delete ret.__v
        return ret
      },
    },
  }
)

// Indexes
userSchema.index({ email: 1 })
userSchema.index({ username: 1 })
userSchema.index({ createdAt: -1 })

// Pre-save hook to hash password
userSchema.pre('save', async function (next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return next()
  }

  try {
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error as Error)
  }
})

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password)
  } catch (error) {
    return false
  }
}

export const User = mongoose.model<IUser>('User', userSchema)
