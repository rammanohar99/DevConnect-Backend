import { z } from 'zod'

// Update profile validation schema
export const updateProfileSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(100, 'Name must not exceed 100 characters')
      .trim()
      .optional(),
    bio: z.string().max(500, 'Bio must not exceed 500 characters').trim().optional(),
    skills: z.array(z.string().trim()).max(20, 'Cannot have more than 20 skills').optional(),
    socialLinks: z
      .object({
        github: z.string().url('Invalid GitHub URL').optional().or(z.literal('')),
        linkedin: z.string().url('Invalid LinkedIn URL').optional().or(z.literal('')),
        twitter: z.string().url('Invalid Twitter URL').optional().or(z.literal('')),
      })
      .optional(),
  }),
})

// User ID parameter validation
export const userIdParamSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid user ID format'),
  }),
})

// Change password validation schema
export const changePasswordSchema = z.object({
  body: z
    .object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(100, 'Password must not exceed 100 characters')
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
          'Password must contain at least one uppercase letter, one lowercase letter, and one number'
        ),
      confirmPassword: z.string().min(1, 'Password confirmation is required'),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    }),
})

// Update notification preferences validation schema
export const updateNotificationPreferencesSchema = z.object({
  body: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    postComments: z.boolean().optional(),
    issueUpdates: z.boolean().optional(),
    chatMessages: z.boolean().optional(),
  }),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type UserIdParamInput = z.infer<typeof userIdParamSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type UpdateNotificationPreferencesInput = z.infer<
  typeof updateNotificationPreferencesSchema
>
