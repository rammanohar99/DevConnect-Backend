import { Request, Response, NextFunction } from 'express'
import { sanitizeObject } from '../utils/sanitize'

/**
 * Middleware to sanitize request body, query, and params
 */
export const sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body)
  }

  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query as Record<string, any>)
  }

  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params)
  }

  next()
}
