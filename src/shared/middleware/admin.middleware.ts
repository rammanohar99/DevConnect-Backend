import { Request, Response, NextFunction } from 'express'
import { AuthenticationError, AuthorizationError } from '../types/errors'

/**
 * Middleware to check if user has admin role
 * Requires authentication middleware to be applied first
 */
export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    return next(new AuthenticationError('Authentication required'))
  }

  if (req.user.role !== 'admin') {
    return next(new AuthorizationError('Admin access required'))
  }

  next()
}

/**
 * Middleware to check if user has moderator or admin role
 * Requires authentication middleware to be applied first
 */
export const requireModerator = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    return next(new AuthenticationError('Authentication required'))
  }

  if (req.user.role !== 'moderator' && req.user.role !== 'admin') {
    return next(new AuthorizationError('Moderator or admin access required'))
  }

  next()
}
