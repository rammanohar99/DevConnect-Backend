import { Request, Response, NextFunction } from 'express'
import { authService } from './auth.service'
import { RegisterDTO, LoginDTO } from './auth.types'
import logger from '../../shared/utils/logger'

export class AuthController {
  /**
   * Register a new user
   * POST /api/v1/auth/register
   */
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: RegisterDTO = req.body

      const result = await authService.register(data)

      logger.info('User registered successfully', {
        userId: result.user.id,
        email: result.user.email,
      })

      res.status(201).json({
        status: 'success',
        message: 'User registered successfully',
        data: result,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Login user
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data: LoginDTO = req.body

      const result = await authService.login(data)

      logger.info('User logged in successfully', {
        userId: result.user.id,
        email: result.user.email,
      })

      res.status(200).json({
        status: 'success',
        message: 'Login successful',
        data: result,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Refresh access token
   * POST /api/v1/auth/refresh
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body

      const result = await authService.refreshToken(refreshToken)

      res.status(200).json({
        status: 'success',
        message: 'Token refreshed successfully',
        data: result,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Logout user
   * POST /api/v1/auth/logout
   */
  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body
      const userId = req.user?.userId

      if (!userId) {
        res.status(401).json({
          status: 'error',
          message: 'Authentication required',
        })
        return
      }

      await authService.logout(userId, refreshToken)

      logger.info('User logged out successfully', { userId })

      res.status(200).json({
        status: 'success',
        message: 'Logout successful',
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get current user
   * GET /api/v1/auth/me
   */
  async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId

      if (!userId) {
        res.status(401).json({
          status: 'error',
          message: 'Authentication required',
        })
        return
      }

      const { User } = await import('../users/user.model')
      const user = await User.findById(userId)

      if (!user) {
        res.status(404).json({
          status: 'error',
          message: 'User not found',
        })
        return
      }

      const { mapUserToResponse } = await import('./auth.types')

      res.status(200).json({
        status: 'success',
        data: {
          user: mapUserToResponse(user),
        },
      })
    } catch (error) {
      next(error)
    }
  }
}

export const authController = new AuthController()
