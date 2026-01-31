import { IUser } from './user.model'

export interface UpdateProfileDTO {
  name?: string
  bio?: string
  skills?: string[]
  socialLinks?: {
    github?: string
    linkedin?: string
    twitter?: string
  }
}

export interface PublicProfile {
  id: string
  username: string
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
  createdAt: Date
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

export interface UserListItem {
  _id: string
  username: string
  email: string
  profile: {
    name: string
    avatar?: string
  }
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

export const mapUserToPublicProfile = (user: IUser): PublicProfile => {
  return {
    id: user._id.toString(),
    username: user.username,
    profile: user.profile,
    createdAt: user.createdAt,
  }
}
