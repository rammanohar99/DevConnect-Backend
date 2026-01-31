import * as fc from 'fast-check'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { AuthService } from '../auth.service'
import { User } from '../../users/user.model'
import { RegisterDTO, LoginDTO } from '../auth.types'
import { AuthenticationError, ConflictError } from '../../../shared/types/errors'

describe('Authentication Service Property Tests', () => {
  let mongoServer: MongoMemoryServer
  let authService: AuthService

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create()
    const mongoUri = mongoServer.getUri()
    await mongoose.connect(mongoUri)
  })

  afterAll(async () => {
    await mongoose.disconnect()
    await mongoServer.stop()
  })

  beforeEach(async () => {
    await User.deleteMany({})
    authService = new AuthService()
  })

  // Feature: devconnect-pro-platform, Property 1: User registration creates valid accounts
  describe('Property 1: User registration creates valid accounts', () => {
    it('should create accounts with hashed passwords and allow subsequent login', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            username: fc
              .string({ minLength: 3, maxLength: 20 })
              .filter((s) => /^[a-zA-Z0-9_]+$/.test(s)),
            password: fc
              .string({ minLength: 8, maxLength: 100 })
              .filter((s) => s.trim().length >= 8),
            name: fc.string({ minLength: 2, maxLength: 100 }).filter((s) => s.trim().length >= 2),
          }),
          async (credentials: RegisterDTO) => {
            // Clean up before test
            await User.deleteMany({
              $or: [{ email: credentials.email }, { username: credentials.username }],
            })

            // Register user
            const result = await authService.register(credentials)

            // Verify response structure
            expect(result).toHaveProperty('user')
            expect(result).toHaveProperty('accessToken')
            expect(result).toHaveProperty('refreshToken')

            // Verify user data
            expect(result.user.email).toBe(credentials.email)
            expect(result.user.username).toBe(credentials.username)
            expect(result.user.profile.name).toBe(credentials.name.trim())

            // Verify tokens are non-empty strings
            expect(typeof result.accessToken).toBe('string')
            expect(result.accessToken.length).toBeGreaterThan(0)
            expect(typeof result.refreshToken).toBe('string')
            expect(result.refreshToken.length).toBeGreaterThan(0)

            // Verify password is hashed (not plaintext)
            const userInDb = await User.findOne({ email: credentials.email }).select('+password')
            expect(userInDb).toBeDefined()
            expect(userInDb!.password).not.toBe(credentials.password)
            expect(userInDb!.password).toMatch(/^\$2[aby]\$/) // bcrypt hash format

            // Verify can login with same credentials
            const loginResult = await authService.login({
              email: credentials.email,
              password: credentials.password,
            })
            expect(loginResult.accessToken).toBeDefined()
            expect(loginResult.user.email).toBe(credentials.email)

            // Clean up after test
            await User.deleteMany({ email: credentials.email })
          }
        ),
        { numRuns: 50 }
      )
    })

    it('should reject duplicate email registrations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            username: fc
              .string({ minLength: 3, maxLength: 20 })
              .filter((s) => /^[a-zA-Z0-9_]+$/.test(s)),
            password: fc
              .string({ minLength: 8, maxLength: 100 })
              .filter((s) => s.trim().length >= 8),
            name: fc.string({ minLength: 2, maxLength: 100 }).filter((s) => s.trim().length >= 2),
          }),
          fc.string({ minLength: 3, maxLength: 20 }).filter((s) => /^[a-zA-Z0-9_]+$/.test(s)),
          async (credentials: RegisterDTO, differentUsername: string) => {
            // Clean up before test
            await User.deleteMany({
              $or: [{ email: credentials.email }, { username: credentials.username }],
            })

            // Register first user
            await authService.register(credentials)

            // Try to register with same email but different username
            const duplicateAttempt = {
              ...credentials,
              username: differentUsername,
            }

            // Should throw ConflictError
            await expect(authService.register(duplicateAttempt)).rejects.toThrow(ConflictError)
            await expect(authService.register(duplicateAttempt)).rejects.toThrow(
              'Email already registered'
            )

            // Clean up
            await User.deleteMany({ email: credentials.email })
          }
        ),
        { numRuns: 30 }
      )
    })
  })

  // Feature: devconnect-pro-platform, Property 2: Valid login returns authentication tokens
  describe('Property 2: Valid login returns authentication tokens', () => {
    it('should return valid tokens for registered users with correct credentials', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            username: fc
              .string({ minLength: 3, maxLength: 20 })
              .filter((s) => /^[a-zA-Z0-9_]+$/.test(s)),
            password: fc
              .string({ minLength: 8, maxLength: 100 })
              .filter((s) => s.trim().length >= 8),
            name: fc.string({ minLength: 2, maxLength: 100 }).filter((s) => s.trim().length >= 2),
          }),
          async (credentials: RegisterDTO) => {
            // Clean up before test
            await User.deleteMany({
              $or: [{ email: credentials.email }, { username: credentials.username }],
            })

            // Register user first
            await authService.register(credentials)

            // Login with same credentials
            const loginData: LoginDTO = {
              email: credentials.email,
              password: credentials.password,
            }

            const result = await authService.login(loginData)

            // Verify response structure
            expect(result).toHaveProperty('user')
            expect(result).toHaveProperty('accessToken')
            expect(result).toHaveProperty('refreshToken')

            // Verify tokens can be verified
            const decodedAccess = authService.verifyToken(result.accessToken)
            expect(decodedAccess.userId).toBe(result.user.id)
            expect(decodedAccess.email).toBe(credentials.email)
            expect(decodedAccess.role).toBe('user')

            // Verify user data matches
            expect(result.user.email).toBe(credentials.email)
            expect(result.user.username).toBe(credentials.username)

            // Clean up
            await User.deleteMany({ email: credentials.email })
          }
        ),
        { numRuns: 50 }
      )
    })
  })

  // Feature: devconnect-pro-platform, Property 3: Token refresh extends authentication
  describe('Property 3: Token refresh extends authentication', () => {
    it('should generate new tokens from valid refresh token without re-authentication', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            username: fc
              .string({ minLength: 3, maxLength: 20 })
              .filter((s) => /^[a-zA-Z0-9_]+$/.test(s)),
            password: fc
              .string({ minLength: 8, maxLength: 100 })
              .filter((s) => s.trim().length >= 8),
            name: fc.string({ minLength: 2, maxLength: 100 }).filter((s) => s.trim().length >= 2),
          }),
          async (credentials: RegisterDTO) => {
            // Clean up before test
            await User.deleteMany({
              $or: [{ email: credentials.email }, { username: credentials.username }],
            })

            // Register and get initial tokens
            const registerResult = await authService.register(credentials)
            const initialRefreshToken = registerResult.refreshToken
            const initialAccessToken = registerResult.accessToken

            // Small delay to ensure different timestamps in JWT
            await new Promise((resolve) => setTimeout(resolve, 1000))

            // Use refresh token to get new tokens
            const refreshResult = await authService.refreshToken(initialRefreshToken)

            // Verify new tokens are returned
            expect(refreshResult).toHaveProperty('accessToken')
            expect(refreshResult).toHaveProperty('refreshToken')
            expect(typeof refreshResult.accessToken).toBe('string')
            expect(refreshResult.accessToken.length).toBeGreaterThan(0)
            expect(typeof refreshResult.refreshToken).toBe('string')
            expect(refreshResult.refreshToken.length).toBeGreaterThan(0)

            // Verify new tokens are different from old ones
            expect(refreshResult.accessToken).not.toBe(initialAccessToken)
            expect(refreshResult.refreshToken).not.toBe(initialRefreshToken)

            // Verify new access token is valid
            const decoded = authService.verifyToken(refreshResult.accessToken)
            expect(decoded.email).toBe(credentials.email)

            // Verify old refresh token is no longer valid
            await expect(authService.refreshToken(initialRefreshToken)).rejects.toThrow(
              AuthenticationError
            )

            // Clean up
            await User.deleteMany({ email: credentials.email })
          }
        ),
        { numRuns: 50, timeout: 60000 }
      )
    })
  })

  // Feature: devconnect-pro-platform, Property 4: Invalid credentials are rejected
  describe('Property 4: Invalid credentials are rejected', () => {
    it('should reject login attempts with wrong password', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            username: fc
              .string({ minLength: 3, maxLength: 20 })
              .filter((s) => /^[a-zA-Z0-9_]+$/.test(s)),
            password: fc
              .string({ minLength: 8, maxLength: 100 })
              .filter((s) => s.trim().length >= 8),
            name: fc.string({ minLength: 2, maxLength: 100 }).filter((s) => s.trim().length >= 2),
          }),
          fc.string({ minLength: 8, maxLength: 100 }).filter((s) => s.trim().length >= 8),
          async (credentials: RegisterDTO, wrongPassword: string) => {
            fc.pre(wrongPassword !== credentials.password) // Ensure passwords are different

            // Clean up before test
            await User.deleteMany({
              $or: [{ email: credentials.email }, { username: credentials.username }],
            })

            // Register user
            await authService.register(credentials)

            // Try to login with wrong password
            const loginData: LoginDTO = {
              email: credentials.email,
              password: wrongPassword,
            }

            await expect(authService.login(loginData)).rejects.toThrow(AuthenticationError)
            await expect(authService.login(loginData)).rejects.toThrow('Invalid email or password')

            // Clean up
            await User.deleteMany({ email: credentials.email })
          }
        ),
        { numRuns: 50, timeout: 60000 }
      )
    })

    it('should reject login attempts with non-existent email', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 100 }).filter((s) => s.trim().length >= 8),
          async (email: string, password: string) => {
            // Ensure email doesn't exist
            await User.deleteMany({ email })

            // Try to login without registering
            const loginData: LoginDTO = { email, password }

            await expect(authService.login(loginData)).rejects.toThrow(AuthenticationError)
            await expect(authService.login(loginData)).rejects.toThrow('Invalid email or password')
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should reject invalid refresh tokens', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 200 }),
          async (invalidToken: string) => {
            await expect(authService.refreshToken(invalidToken)).rejects.toThrow(
              AuthenticationError
            )
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
