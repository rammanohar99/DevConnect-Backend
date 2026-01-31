import { Request, Response, NextFunction } from 'express'
import { authService } from '../../modules/auth/auth.service'
import { AuthenticationError, AuthorizationError } from '../types/errors'
import { JWTPayload } from '../../modules/auth/auth.types'

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload
    }
  }
}

/**
 * Middleware to authenticate JWT token
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No token provided')
    }

    const token = authHeader.substring(7) // Remove 'Bearer ' prefix

    // Verify token
    const decoded = authService.verifyToken(token)

    // Attach user to request
    req.user = decoded

    next()
  } catch (error) {
    next(error)
  }
}

/**
 * Middleware to check if user has required role
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'))
    }

    if (!roles.includes(req.user.role)) {
      return next(new AuthorizationError(`Access denied. Required role: ${roles.join(' or ')}`))
    }

    next()
  }
}

/**
 * Middleware to check if user is admin
 */
export const requireAdmin = authorize('admin')

/**
 * Middleware to check if user is moderator or admin
 */
export const requireModerator = authorize('moderator', 'admin')

/**
 * Optional authentication - doesn't fail if no token provided
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7)
      const decoded = authService.verifyToken(token)
      req.user = decoded
    }

    next()
  } catch (error) {
    // Ignore authentication errors for optional auth
    next()
  }
}
