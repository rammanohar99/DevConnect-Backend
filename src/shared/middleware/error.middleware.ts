import { Request, Response, NextFunction } from 'express'
import { AppError, ValidationError } from '../types/errors'
import logger from '../utils/logger'

interface ErrorResponse {
  status: 'error'
  statusCode: number
  message: string
  errors?: Array<{ field: string; message: string }>
  stack?: string
  requestId?: string
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log error with full details
  logger.error('Error occurred', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    requestId: req.id,
    path: req.path,
    method: req.method,
    statusCode: err instanceof AppError ? err.statusCode : 500,
  })

  // Handle operational errors
  if (err instanceof AppError && err.isOperational) {
    const response: ErrorResponse = {
      status: 'error',
      statusCode: err.statusCode,
      message: err.message,
      requestId: req.id,
    }

    // Add validation errors if present
    if (err instanceof ValidationError) {
      response.errors = err.errors
    }

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
      response.stack = err.stack
    }

    res.status(err.statusCode).json(response)
    return
  }

  // Handle unexpected errors
  const response: ErrorResponse = {
    status: 'error',
    statusCode: 500,
    message: 'An unexpected error occurred',
    requestId: req.id,
  }

  if (process.env.NODE_ENV === 'development') {
    response.message = err.message
    response.stack = err.stack
  }

  res.status(500).json(response)
}

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    status: 'error',
    statusCode: 404,
    message: `Route ${req.originalUrl} not found`,
    requestId: req.id,
  })
}
