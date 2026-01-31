import { z } from 'zod'

/**
 * Environment variable validation schema
 * Ensures all required environment variables are present and valid
 */
const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().positive()).default('3000'),

  // Database
  MONGODB_URI: z.string().url('Invalid MongoDB URI'),
  MONGODB_TEST_URI: z.string().url('Invalid MongoDB test URI').optional(),

  // Redis
  REDIS_URL: z.string().url('Invalid Redis URL'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_SECRET: z.string().min(32, 'REFRESH_TOKEN_SECRET must be at least 32 characters'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  // AWS S3
  AWS_REGION: z.string().min(1, 'AWS_REGION is required'),
  AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS_ACCESS_KEY_ID is required'),
  AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS_SECRET_ACCESS_KEY is required'),
  S3_BUCKET_NAME: z.string().min(1, 'S3_BUCKET_NAME is required'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).pipe(z.number().positive()).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).pipe(z.number().positive()).default('100'),

  // File Upload
  MAX_FILE_SIZE: z.string().transform(Number).pipe(z.number().positive()).default('5242880'),
  ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/gif,image/webp'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly']).default('info'),

  // Optional: Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).pipe(z.number().positive()).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // Optional: Monitoring
  SENTRY_DSN: z.string().url().optional(),
})

export type EnvConfig = z.infer<typeof envSchema>

/**
 * Validate environment variables on application startup
 * Throws an error if validation fails
 */
export function validateEnv(): EnvConfig {
  try {
    const validated = envSchema.parse(process.env)

    // Additional validation for production
    if (validated.NODE_ENV === 'production') {
      // Check for insecure secrets in production
      const insecureSecrets = [
        'dev-jwt-secret',
        'dev-refresh-secret',
        'your-super-secret',
        'change-this',
      ]

      const hasInsecureJWT = insecureSecrets.some((secret) =>
        validated.JWT_SECRET.toLowerCase().includes(secret)
      )
      const hasInsecureRefresh = insecureSecrets.some((secret) =>
        validated.REFRESH_TOKEN_SECRET.toLowerCase().includes(secret)
      )

      if (hasInsecureJWT || hasInsecureRefresh) {
        throw new Error(
          'SECURITY ERROR: Production environment detected with insecure JWT secrets! ' +
            'Please generate strong secrets using: openssl rand -base64 32'
        )
      }

      // Warn about missing optional production features
      if (!validated.SENTRY_DSN) {
        console.warn('WARNING: SENTRY_DSN not configured. Error tracking disabled.')
      }
    }

    return validated
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:')
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`)
      })
      console.error('\nPlease check your .env file and ensure all required variables are set.')
      console.error('See .env.example for reference.\n')
    } else {
      console.error('❌ Environment validation error:', error)
    }
    process.exit(1)
  }
}

/**
 * Get validated environment configuration
 * Call this after validateEnv() has been called
 */
export function getEnvConfig(): EnvConfig {
  return envSchema.parse(process.env)
}
