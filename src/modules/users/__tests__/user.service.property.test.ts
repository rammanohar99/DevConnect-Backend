import * as fc from 'fast-check'
import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { UserService } from '../user.service'
import { User } from '../user.model'
import { UpdateProfileDTO } from '../user.types'

describe('User Service Property Tests', () => {
  let mongoServer: MongoMemoryServer
  let userService: UserService

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
    userService = new UserService()
  })

  // Feature: devconnect-pro-platform, Property 6: Profile updates persist correctly
  describe('Property 6: Profile updates persist correctly', () => {
    it('should persist profile updates with round-trip consistency', async () => {
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
          fc.record({
            name: fc.option(
              fc.string({ minLength: 2, maxLength: 100 }).filter((s) => s.trim().length >= 2),
              { nil: undefined }
            ),
            bio: fc.option(
              fc.string({ minLength: 1, maxLength: 500 }).filter((s) => s.trim().length >= 1),
              { nil: undefined }
            ),
            skills: fc.option(
              fc.array(
                fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length >= 1),
                { minLength: 0, maxLength: 20 }
              ),
              { nil: undefined }
            ),
            socialLinks: fc.option(
              fc.record({
                github: fc.option(fc.webUrl(), { nil: undefined }),
                linkedin: fc.option(fc.webUrl(), { nil: undefined }),
                twitter: fc.option(fc.webUrl(), { nil: undefined }),
              }),
              { nil: undefined }
            ),
          }),
          async (userData, updateData: UpdateProfileDTO) => {
            // Clean up before test
            await User.deleteMany({
              $or: [{ email: userData.email }, { username: userData.username }],
            })

            // Create user
            const user = await User.create({
              email: userData.email,
              password: userData.password,
              username: userData.username,
              profile: {
                name: userData.name,
                skills: [],
                socialLinks: {},
              },
            })

            // Update profile
            const updatedUser = await userService.updateProfile(user._id.toString(), updateData)

            // Verify updates were applied (model trims strings, so compare trimmed values)
            if (updateData.name !== undefined) {
              expect(updatedUser.profile.name).toBe(updateData.name.trim())
            }
            if (updateData.bio !== undefined) {
              expect(updatedUser.profile.bio).toBe(updateData.bio.trim())
            }
            if (updateData.skills !== undefined) {
              expect(updatedUser.profile.skills).toEqual(updateData.skills)
            }
            if (updateData.socialLinks !== undefined) {
              if (updateData.socialLinks.github !== undefined) {
                expect(updatedUser.profile.socialLinks.github).toBe(
                  updateData.socialLinks.github.trim()
                )
              }
              if (updateData.socialLinks.linkedin !== undefined) {
                expect(updatedUser.profile.socialLinks.linkedin).toBe(
                  updateData.socialLinks.linkedin.trim()
                )
              }
              if (updateData.socialLinks.twitter !== undefined) {
                expect(updatedUser.profile.socialLinks.twitter).toBe(
                  updateData.socialLinks.twitter.trim()
                )
              }
            }

            // Round-trip: retrieve user and verify data persisted
            const retrievedUser = await userService.getUserById(user._id.toString())
            if (updateData.name !== undefined) {
              expect(retrievedUser.profile.name).toBe(updateData.name.trim())
            }
            if (updateData.bio !== undefined) {
              expect(retrievedUser.profile.bio).toBe(updateData.bio.trim())
            }
            if (updateData.skills !== undefined) {
              expect(retrievedUser.profile.skills).toEqual(updateData.skills)
            }

            // Clean up
            await User.deleteMany({ email: userData.email })
          }
        ),
        { numRuns: 50, timeout: 15000 }
      )
    })
  })

  // Feature: devconnect-pro-platform, Property 7: Avatar uploads return accessible URLs
  describe('Property 7: Avatar uploads return accessible URLs', () => {
    it('should store avatar URLs and make them accessible', async () => {
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
          fc.webUrl({ validSchemes: ['https'] }),
          async (userData, avatarUrl) => {
            // Clean up before test
            await User.deleteMany({
              $or: [{ email: userData.email }, { username: userData.username }],
            })

            // Create user
            const user = await User.create({
              email: userData.email,
              password: userData.password,
              username: userData.username,
              profile: {
                name: userData.name,
                skills: [],
                socialLinks: {},
              },
            })

            // Update avatar
            const updatedUser = await userService.updateAvatar(user._id.toString(), avatarUrl)

            // Verify avatar URL is stored
            expect(updatedUser.profile.avatar).toBe(avatarUrl)
            expect(updatedUser.profile.avatar).toMatch(/^https:\/\//)

            // Verify avatar is accessible in subsequent retrieval
            const retrievedUser = await userService.getUserById(user._id.toString())
            expect(retrievedUser.profile.avatar).toBe(avatarUrl)

            // Clean up
            await User.deleteMany({ email: userData.email })
          }
        ),
        { numRuns: 50, timeout: 15000 }
      )
    })
  })

  // Feature: devconnect-pro-platform, Property 9: Public profiles expose only public data
  describe('Property 9: Public profiles expose only public data', () => {
    it('should not expose sensitive data in public profiles', async () => {
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
            bio: fc.string({ minLength: 1, maxLength: 500 }).filter((s) => s.trim().length >= 1),
            skills: fc.array(
              fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length >= 1),
              { minLength: 0, maxLength: 10 }
            ),
          }),
          async (userData) => {
            // Clean up before test
            await User.deleteMany({
              $or: [{ email: userData.email }, { username: userData.username }],
            })

            // Create user with sensitive data
            const user = await User.create({
              email: userData.email,
              password: userData.password,
              username: userData.username,
              profile: {
                name: userData.name,
                bio: userData.bio,
                skills: userData.skills,
                socialLinks: {},
              },
              refreshTokens: ['sensitive-refresh-token-1', 'sensitive-refresh-token-2'],
            })

            // Get public profile
            const publicProfile = await userService.getUserProfile(user._id.toString())

            // Verify public data is present (model trims strings)
            expect(publicProfile.username).toBe(userData.username)
            expect(publicProfile.profile.name).toBe(userData.name.trim())
            expect(publicProfile.profile.bio).toBe(userData.bio.trim())
            expect(publicProfile.profile.skills).toEqual(userData.skills)

            // Verify sensitive data is NOT present
            expect(publicProfile).not.toHaveProperty('password')
            expect(publicProfile).not.toHaveProperty('email')
            expect(publicProfile).not.toHaveProperty('refreshTokens')
            expect(publicProfile).not.toHaveProperty('isEmailVerified')

            // Verify the object doesn't contain any password-like strings
            const profileString = JSON.stringify(publicProfile)
            expect(profileString).not.toContain(userData.password)
            expect(profileString).not.toContain('refresh')
            expect(profileString).not.toContain('token')

            // Clean up
            await User.deleteMany({ email: userData.email })
          }
        ),
        { numRuns: 50, timeout: 15000 }
      )
    })
  })
})
