import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import logger from '../utils/logger'

declare global {
  namespace Express {
    interface Request {
      id: string
      startTime: number
    }
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Generate unique request ID
  req.id = uuidv4()
  req.startTime = Date.now()

  // Log request
  logger.http(`${req.method} ${req.path}`, {
    requestId: req.id,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  })

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - req.startTime
    logger.http(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`, {
      requestId: req.id,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    })
  })

  next()
}
