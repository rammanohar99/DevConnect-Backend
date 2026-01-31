import { Router } from 'express'
import { authController } from './auth.controller'
import { validate } from '../../shared/middleware/validation.middleware'
import { authenticate } from '../../shared/middleware/auth.middleware'
import { registerSchema, loginSchema, refreshTokenSchema, logoutSchema } from './auth.validation'

const router = Router()

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', validate(registerSchema), authController.register.bind(authController))

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', validate(loginSchema), authController.login.bind(authController))

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', validate(refreshTokenSchema), authController.refresh.bind(authController))

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post(
  '/logout',
  authenticate,
  validate(logoutSchema),
  authController.logout.bind(authController)
)

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get('/me', authenticate, authController.getCurrentUser.bind(authController))

export default router
