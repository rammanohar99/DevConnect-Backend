import * as fc from 'fast-check'
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { authenticate, authorize } from '../auth.middleware'
import { config } from '../../../config/env'
import { AuthenticationError, AuthorizationError } from '../../types/errors'

// Feature: devconnect-pro-platform, Property 5: Protected endpoints enforce authorization
describe('Authorization Middleware Property Tests', () => {
  let mockRequest: Partial<Request>
  let mockResponse: Partial<Response>
  let mockNext: NextFunction

  beforeEach(() => {
    mockRequest = {
      headers: {},
    }
    mockResponse = {}
    mockNext = jest.fn()
  })

  describe('Property 5: Protected endpoints enforce authorization', () => {
    it('should reject requests without authorization header', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            path: fc.string({ minLength: 1, maxLength: 100 }),
            method: fc.constantFrom('GET', 'POST', 'PUT', 'DELETE', 'PATCH'),
          }),
          async (requestData) => {
            mockRequest = {
              headers: {},
              path: requestData.path,
              method: requestData.method,
            }
            mockNext = jest.fn()

            await authenticate(mockRequest as Request, mockResponse as Response, mockNext)

            expect(mockNext).toHaveBeenCalledTimes(1)
            expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError))
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should reject requests with invalid token format', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 200 }).filter((s) => !s.startsWith('Bearer ')),
          async (invalidToken) => {
            mockRequest = {
              headers: {
                authorization: invalidToken,
              },
            }
            mockNext = jest.fn()

            await authenticate(mockRequest as Request, mockResponse as Response, mockNext)

            expect(mockNext).toHaveBeenCalledTimes(1)
            expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError))
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should reject requests with invalid JWT tokens', async () => {
      await fc.assert(
        fc.asyncProperty(fc.string({ minLength: 10, maxLength: 200 }), async (invalidJwt) => {
          mockRequest = {
            headers: {
              authorization: `Bearer ${invalidJwt}`,
            },
          }
          mockNext = jest.fn()

          await authenticate(mockRequest as Request, mockResponse as Response, mockNext)

          expect(mockNext).toHaveBeenCalledTimes(1)
          expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError))
        }),
        { numRuns: 100 }
      )
    })

    it('should accept requests with valid JWT tokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            email: fc.emailAddress(),
            role: fc.constantFrom('user', 'moderator', 'admin'),
          }),
          async (payload) => {
            // Generate valid token
            const token = jwt.sign(payload, config.jwt.secret, { expiresIn: '15m' })

            mockRequest = {
              headers: {
                authorization: `Bearer ${token}`,
              },
            }
            mockNext = jest.fn()

            await authenticate(mockRequest as Request, mockResponse as Response, mockNext)

            // Should call next() without error
            expect(mockNext).toHaveBeenCalledTimes(1)
            expect(mockNext).toHaveBeenCalledWith()

            // Should attach user to request
            expect(mockRequest.user).toBeDefined()
            expect(mockRequest.user).toMatchObject(payload)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should enforce role-based access control', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userRole: fc.constantFrom('user', 'moderator', 'admin'),
            requiredRoles: fc.array(fc.constantFrom('user', 'moderator', 'admin'), {
              minLength: 1,
              maxLength: 3,
            }),
          }),
          async ({ userRole, requiredRoles }) => {
            mockRequest = {
              user: {
                userId: 'test-user-id',
                email: 'test@example.com',
                role: userRole,
              },
            }
            mockNext = jest.fn()

            const middleware = authorize(...requiredRoles)

            middleware(mockRequest as Request, mockResponse as Response, mockNext)

            if (requiredRoles.includes(userRole)) {
              // User has required role
              expect(mockNext).toHaveBeenCalledTimes(1)
              expect(mockNext).toHaveBeenCalledWith()
            } else {
              // User lacks required role
              expect(mockNext).toHaveBeenCalledTimes(1)
              expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError))
            }
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should reject expired tokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.uuid(),
            email: fc.emailAddress(),
            role: fc.constantFrom('user', 'moderator', 'admin'),
          }),
          async (payload) => {
            // Generate expired token (expired 1 hour ago)
            const token = jwt.sign(payload, config.jwt.secret, { expiresIn: '-1h' })

            mockRequest = {
              headers: {
                authorization: `Bearer ${token}`,
              },
            }
            mockNext = jest.fn()

            await authenticate(mockRequest as Request, mockResponse as Response, mockNext)

            expect(mockNext).toHaveBeenCalledTimes(1)
            expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError))
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
