import { Router } from 'express'
import multer from 'multer'
import { userController } from './user.controller'
import { authenticate } from '../../shared/middleware/auth.middleware'
import { validate } from '../../shared/middleware/validation.middleware'
import {
  updateProfileSchema,
  userIdParamSchema,
  changePasswordSchema,
  updateNotificationPreferencesSchema,
} from './user.validation'

const router = Router()

// Configure multer for memory storage (files stored in memory as Buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
})

// Get all users (for chat user selection)
router.get('/', authenticate, userController.getAllUsers.bind(userController))

// Get user by ID (authenticated users only)
router.get(
  '/:id',
  authenticate,
  validate(userIdParamSchema),
  userController.getUser.bind(userController)
)

// Update user profile (authenticated users only, own profile)
router.put(
  '/:id/profile',
  authenticate,
  validate(userIdParamSchema),
  validate(updateProfileSchema),
  userController.updateProfile.bind(userController)
)

// Upload user avatar (authenticated users only, own avatar)
router.post(
  '/:id/avatar',
  authenticate,
  validate(userIdParamSchema),
  upload.single('avatar'),
  userController.uploadAvatar.bind(userController)
)

// Get public user profile (no authentication required)
router.get(
  '/:id/public',
  validate(userIdParamSchema),
  userController.getPublicProfile.bind(userController)
)

// Change user password (authenticated users only, own password)
router.put(
  '/:id/password',
  authenticate,
  validate(userIdParamSchema),
  validate(changePasswordSchema),
  userController.changePassword.bind(userController)
)

// Update notification preferences (authenticated users only, own settings)
router.patch(
  '/:id/settings/notifications',
  authenticate,
  validate(userIdParamSchema),
  validate(updateNotificationPreferencesSchema),
  userController.updateNotificationPreferences.bind(userController)
)

export default router
