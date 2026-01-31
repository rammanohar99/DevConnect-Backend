import { IUser } from '../users/user.model'

export interface RegisterDTO {
  email: string
  password: string
  username: string
  name: string
}

export interface LoginDTO {
  email: string
  password: string
}

export interface AuthResponse {
  user: UserResponse
  accessToken: string
  refreshToken: string
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
}

export interface UserResponse {
  id: string
  email: string
  username: string
  role: string
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
  isEmailVerified: boolean
  createdAt: Date
  updatedAt: Date
}

export interface JWTPayload {
  userId: string
  email: string
  role: string
}

export const mapUserToResponse = (user: IUser): UserResponse => {
  return {
    id: user._id.toString(),
    email: user.email,
    username: user.username,
    role: user.role,
    profile: user.profile,
    isEmailVerified: user.isEmailVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}
