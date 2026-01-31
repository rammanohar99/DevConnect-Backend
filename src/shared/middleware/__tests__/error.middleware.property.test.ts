import * as fc from 'fast-check'
import { Request, Response, NextFunction } from 'express'
import { errorHandler } from '../error.middleware'
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
} from '../../types/errors'

// Feature: devconnect-pro-platform, Property 36: Error responses follow consistent format
describe('Error Handling Property Tests', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let mockNext: NextFunction
  let jsonSpy: jest.Mock
  let statusSpy: jest.Mock

  beforeEach(() => {
    jsonSpy = jest.fn()
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy })

    mockRequest = {
      id: 'test-request-id',
      path: '/api/test',
      method: 'GET',
    }

    mockResponse = {
      status: statusSpy,
    }

    mockNext = jest.fn()
  })

  it('Property 36: All operational errors return consistent format with correct status codes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.record({
            type: fc.constant('validation' as const),
            message: fc.string({ minLength: 1, maxLength: 100 }),
            errors: fc.array(
              fc.record({
                field: fc.string({ minLength: 1, maxLength: 50 }),
                message: fc.string({ minLength: 1, maxLength: 100 }),
              }),
              { minLength: 1, maxLength: 5 }
            ),
          }),
          fc.record({
            type: fc.constant('authentication' as const),
            message: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          fc.record({
            type: fc.constant('authorization' as const),
            message: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          fc.record({
            type: fc.constant('notFound' as const),
            resource: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          fc.record({
            type: fc.constant('rateLimit' as const),
            message: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          fc.record({
            type: fc.constant('generic' as const),
            message: fc.string({ minLength: 1, maxLength: 100 }),
            statusCode: fc.integer({ min: 400, max: 599 }),
          })
        ),
        async (errorConfig) => {
          // Create error based on type
          let error: Error
          let expectedStatus: number

          if (errorConfig.type === 'validation') {
            error = new ValidationError(errorConfig.message, errorConfig.errors)
            expectedStatus = 400
          } else if (errorConfig.type === 'authentication') {
            error = new AuthenticationError(errorConfig.message)
            expectedStatus = 401
          } else if (errorConfig.type === 'authorization') {
            error = new AuthorizationError(errorConfig.message)
            expectedStatus = 403
          } else if (errorConfig.type === 'notFound') {
            error = new NotFoundError(errorConfig.resource)
            expectedStatus = 404
          } else if (errorConfig.type === 'rateLimit') {
            error = new RateLimitError(errorConfig.message)
            expectedStatus = 429
          } else {
            error = new AppError(errorConfig.message, errorConfig.statusCode)
            expectedStatus = errorConfig.statusCode
          }

          // Reset spies
          jsonSpy.mockClear()
          statusSpy.mockClear()

          // Call error handler
          errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext)

          // Verify status code was called correctly
          expect(statusSpy).toHaveBeenCalledWith(expectedStatus)

          // Verify response format
          expect(jsonSpy).toHaveBeenCalledTimes(1)
          const response = jsonSpy.mock.calls[0][0]

          // Check consistent format
          expect(response).toHaveProperty('status', 'error')
          expect(response).toHaveProperty('statusCode', expectedStatus)
          expect(response).toHaveProperty('message')
          expect(typeof response.message).toBe('string')
          expect(response.message.length).toBeGreaterThan(0)
          expect(response).toHaveProperty('requestId', 'test-request-id')

          // Validation errors should include errors array
          if (errorConfig.type === 'validation') {
            expect(response).toHaveProperty('errors')
            expect(Array.isArray(response.errors)).toBe(true)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 36: Client errors (4xx) are distinguished from server errors (5xx)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 400, max: 599 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (statusCode, message) => {
          const error = new AppError(message, statusCode)

          // Reset spies
          jsonSpy.mockClear()
          statusSpy.mockClear()

          errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext)

          const response = jsonSpy.mock.calls[0][0]

          // Verify status code is in correct range
          expect(response.statusCode).toBe(statusCode)

          // Client errors are 4xx, server errors are 5xx
          if (statusCode >= 400 && statusCode < 500) {
            expect(response.statusCode).toBeGreaterThanOrEqual(400)
            expect(response.statusCode).toBeLessThan(500)
          } else {
            expect(response.statusCode).toBeGreaterThanOrEqual(500)
            expect(response.statusCode).toBeLessThan(600)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 36: Unexpected errors return 500 with generic message', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1, maxLength: 100 }), async (errorMessage) => {
        // Create a non-operational error (regular Error)
        const error = new Error(errorMessage)

        // Reset spies
        jsonSpy.mockClear()
        statusSpy.mockClear()

        errorHandler(error, mockRequest as Request, mockResponse as Response, mockNext)

        // Should return 500
        expect(statusSpy).toHaveBeenCalledWith(500)

        const response = jsonSpy.mock.calls[0][0]

        // Should have consistent format
        expect(response).toHaveProperty('status', 'error')
        expect(response).toHaveProperty('statusCode', 500)
        expect(response).toHaveProperty('message')
        expect(response).toHaveProperty('requestId')

        // Should NOT expose internal error details
        expect(response.message).not.toBe(errorMessage)
        expect(response.message).toBe('An unexpected error occurred')
      }),
      { numRuns: 100 }
    )
  })
})
