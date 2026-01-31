import request from 'supertest'
import app from '../../../app'
import { connectDatabase, disconnectDatabase } from '../../../config/database'
import { User } from '../user.model'
import jwt from 'jsonwebtoken'
import { config } from '../../../config/env'

describe('User Routes Integration Tests', () => {
  let authToken: string
  let userId: string

  beforeAll(async () => {
    await connectDatabase()
  })

  afterAll(async () => {
    await disconnectDatabase()
  })

  beforeEach(async () => {
    // Clean up database
    await User.deleteMany({})

    // Create a test user
    const user = await User.create({
      email: 'test@example.com',
      password: 'password123',
      username: 'testuser',
      profile: {
        name: 'Test User',
        bio: 'Test bio',
        skills: ['JavaScript', 'TypeScript'],
        socialLinks: {
          github: 'https://github.com/testuser',
        },
      },
    })

    userId = user._id.toString()

    // Generate auth token
    authToken = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      },
      config.jwt.secret
    )
  })

  describe('GET /api/v1/users/:id', () => {
    it('should get user by ID when authenticated', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.status).toBe('success')
      expect(response.body.data.user).toBeDefined()
      expect(response.body.data.user.email).toBe('test@example.com')
      expect(response.body.data.user.username).toBe('testuser')
    })

    it('should return 401 when not authenticated', async () => {
      await request(app).get(`/api/v1/users/${userId}`).expect(401)
    })

    it('should return 404 for non-existent user', async () => {
      const fakeId = '507f1f77bcf86cd799439011'
      await request(app)
        .get(`/api/v1/users/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)
    })
  })

  describe('PUT /api/v1/users/:id/profile', () => {
    it('should update user profile when authenticated', async () => {
      const updateData = {
        name: 'Updated Name',
        bio: 'Updated bio',
        skills: ['React', 'Node.js'],
      }

      const response = await request(app)
        .put(`/api/v1/users/${userId}/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body.status).toBe('success')
      expect(response.body.data.user.profile.name).toBe('Updated Name')
      expect(response.body.data.user.profile.bio).toBe('Updated bio')
      expect(response.body.data.user.profile.skills).toEqual(['React', 'Node.js'])
    })

    it('should return 403 when trying to update another user profile', async () => {
      const anotherUser = await User.create({
        email: 'another@example.com',
        password: 'password123',
        username: 'anotheruser',
        profile: {
          name: 'Another User',
        },
      })

      await request(app)
        .put(`/api/v1/users/${anotherUser._id}/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Hacked Name' })
        .expect(403)
    })

    it('should validate profile data', async () => {
      const invalidData = {
        name: 'a'.repeat(101), // Exceeds max length
      }

      await request(app)
        .put(`/api/v1/users/${userId}/profile`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400)
    })
  })

  describe('GET /api/v1/users/:id/public', () => {
    it('should get public profile without authentication', async () => {
      const response = await request(app).get(`/api/v1/users/${userId}/public`).expect(200)

      expect(response.body.status).toBe('success')
      expect(response.body.data.profile).toBeDefined()
      expect(response.body.data.profile.username).toBe('testuser')
      expect(response.body.data.profile.profile.name).toBe('Test User')
      // Should not include email or sensitive data
      expect(response.body.data.profile.email).toBeUndefined()
    })

    it('should return 404 for non-existent user', async () => {
      const fakeId = '507f1f77bcf86cd799439011'
      await request(app).get(`/api/v1/users/${fakeId}/public`).expect(404)
    })
  })
})
