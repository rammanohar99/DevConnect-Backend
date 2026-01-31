import jwt from 'jsonwebtoken'
import { User } from '../users/user.model'
import { config } from '../../config/env'
import {
  RegisterDTO,
  LoginDTO,
  AuthResponse,
  TokenResponse,
  JWTPayload,
  mapUserToResponse,
} from './auth.types'
import { AuthenticationError, ConflictError, NotFoundError } from '../../shared/types/errors'

export class AuthService {
  /**
   * Generate JWT access token
   */
  private generateAccessToken(userId: string, email: string, role: string): string {
    const payload: JWTPayload = {
      userId,
      email,
      role,
    }

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions)
  }

  /**
   * Generate JWT refresh token
   */
  private generateRefreshToken(userId: string, email: string, role: string): string {
    const payload: JWTPayload = {
      userId,
      email,
      role,
    }

    return jwt.sign(payload, config.jwt.refreshSecret, {
      expiresIn: config.jwt.refreshExpiresIn,
    } as jwt.SignOptions)
  }

  /**
   * Register a new user
   */
  async register(data: RegisterDTO): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: data.email }, { username: data.username }],
    })

    if (existingUser) {
      if (existingUser.email === data.email) {
        throw new ConflictError('Email already registered')
      }
      throw new ConflictError('Username already taken')
    }

    // Create new user
    const user = await User.create({
      email: data.email,
      password: data.password,
      username: data.username,
      profile: {
        name: data.name,
        skills: [],
        socialLinks: {},
      },
    })

    // Generate tokens
    const accessToken = this.generateAccessToken(user._id.toString(), user.email, user.role)
    const refreshToken = this.generateRefreshToken(user._id.toString(), user.email, user.role)

    // Save refresh token
    user.refreshTokens.push(refreshToken)
    await user.save()

    return {
      user: mapUserToResponse(user),
      accessToken,
      refreshToken,
    }
  }

  /**
   * Login user
   */
  async login(data: LoginDTO): Promise<AuthResponse> {
    // Find user with password field
    const user = await User.findOne({ email: data.email }).select('+password +refreshTokens')

    if (!user) {
      throw new AuthenticationError('No account found with this email. Ready to join us?')
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(data.password)

    if (!isPasswordValid) {
      throw new AuthenticationError('Incorrect password. Please try again.')
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(user._id.toString(), user.email, user.role)
    const refreshToken = this.generateRefreshToken(user._id.toString(), user.email, user.role)

    // Save refresh token (limit to 5 active refresh tokens)
    user.refreshTokens.push(refreshToken)
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5)
    }
    await user.save()

    return {
      user: mapUserToResponse(user),
      accessToken,
      refreshToken,
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as JWTPayload

      // Find user with refresh tokens
      const user = await User.findById(decoded.userId).select('+refreshTokens')

      if (!user) {
        throw new AuthenticationError('Invalid refresh token')
      }

      // Check if refresh token exists in user's tokens
      if (!user.refreshTokens.includes(refreshToken)) {
        throw new AuthenticationError('Invalid refresh token')
      }

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(user._id.toString(), user.email, user.role)
      const newRefreshToken = this.generateRefreshToken(user._id.toString(), user.email, user.role)

      // Replace old refresh token with new one
      user.refreshTokens = user.refreshTokens.filter((token) => token !== refreshToken)
      user.refreshTokens.push(newRefreshToken)
      await user.save()

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      }
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid refresh token')
      }
      throw error
    }
  }

  /**
   * Logout user (invalidate refresh token)
   */
  async logout(userId: string, refreshToken: string): Promise<void> {
    const user = await User.findById(userId).select('+refreshTokens')

    if (!user) {
      throw new NotFoundError('User')
    }

    // Remove refresh token
    user.refreshTokens = user.refreshTokens.filter((token) => token !== refreshToken)
    await user.save()
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as JWTPayload
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Token expired')
      }
      throw new AuthenticationError('Invalid token')
    }
  }
}

export const authService = new AuthService()
