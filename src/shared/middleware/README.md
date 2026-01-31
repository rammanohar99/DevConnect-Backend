# Middleware Usage Guide

## Rate Limiting Middleware

The rate limiting middleware provides different rate limiters for various endpoint types.

### Available Rate Limiters

1. **apiLimiter** - General API endpoints (100 requests per 15 minutes)
2. **authLimiter** - Authentication endpoints (5 requests per 15 minutes)
3. **uploadLimiter** - File upload endpoints (10 uploads per hour)
4. **passwordResetLimiter** - Password reset endpoints (3 requests per hour)
5. **createAccountLimiter** - Account creation (3 registrations per hour per IP)

### Usage Example

```typescript
import { Router } from 'express'
import { authLimiter, createAccountLimiter, apiLimiter } from '../shared/middleware/rateLimit.middleware'
import { authController } from './auth.controller'

const router = Router()

// Apply rate limiters to specific routes
router.post('/register', createAccountLimiter, authController.register)
router.post('/login', authLimiter, authController.login)
router.post('/refresh', authLimiter, authController.refresh)
router.post('/logout', apiLimiter, authController.logout)

export default router
```

### Integration with Auth Routes

To integrate rate limiting with authentication routes:

```typescript
// In auth.routes.ts
import { authLimiter, createAccountLimiter } from '../../shared/middleware/rateLimit.middleware'

// Apply to registration
router.post('/register', createAccountLimiter, validateRequest(registerSchema), authController.register)

// Apply to login
router.post('/login', authLimiter, validateRequest(loginSchema), authController.login)
```

## Security Logging

The security logger provides specialized logging for security-related events.

### Available Functions

- `logFailedLogin(email, ip, userAgent?, reason?)` - Log failed authentication attempts
- `logSuccessfulLogin(userId, email, ip, userAgent?)` - Log successful logins
- `logRateLimitExceeded(ip, path, method, userId?)` - Log rate limit violations
- `logInvalidToken(ip, path, reason, userId?)` - Log invalid token attempts
- `logExpiredToken(userId, ip, path)` - Log expired token attempts
- `logUnauthorizedAccess(userId, ip, path, method, reason?)` - Log unauthorized access
- `logSuspiciousActivity(ip, pattern, details, userId?)` - Log suspicious patterns
- `logAccountCreated(userId, email, ip, userAgent?)` - Log account creation
- `logPasswordChanged(userId, email, ip)` - Log password changes
- `logRoleChanged(adminId, targetUserId, oldRole, newRole, ip)` - Log role changes
- `logContentModerated(moderatorId, contentType, contentId, action, ip)` - Log moderation actions

### Usage Example in Auth Service

```typescript
import {
  logFailedLogin,
  logSuccessfulLogin,
  logAccountCreated,
} from '../../shared/utils/securityLogger'

export class AuthService {
  async login(data: LoginDTO): Promise<AuthResponse> {
    try {
      const user = await User.findOne({ email: data.email })

      if (!user) {
        // Log failed login attempt
        logFailedLogin(data.email, data.ip || 'unknown', data.userAgent, 'User not found')
        throw new AuthenticationError('Invalid credentials')
      }

      const isPasswordValid = await bcrypt.compare(data.password, user.password)

      if (!isPasswordValid) {
        // Log failed login attempt
        logFailedLogin(data.email, data.ip || 'unknown', data.userAgent, 'Invalid password')
        throw new AuthenticationError('Invalid credentials')
      }

      // Log successful login
      logSuccessfulLogin(user._id.toString(), user.email, data.ip || 'unknown', data.userAgent)

      // Generate tokens and return
      // ...
    } catch (error) {
      throw error
    }
  }

  async register(data: RegisterDTO): Promise<AuthResponse> {
    try {
      // Create user
      const user = await User.create({
        email: data.email,
        username: data.username,
        password: hashedPassword,
        // ...
      })

      // Log account creation
      logAccountCreated(
        user._id.toString(),
        user.email,
        data.ip || 'unknown',
        data.userAgent
      )

      // Return response
      // ...
    } catch (error) {
      throw error
    }
  }
}
```

### Usage Example in Auth Middleware

```typescript
import {
  logInvalidToken,
  logExpiredToken,
  logUnauthorizedAccess,
} from '../utils/securityLogger'

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]

    if (!token) {
      logInvalidToken(req.ip || 'unknown', req.path, 'No token provided')
      throw new AuthenticationError('Authentication required')
    }

    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret) as JWTPayload
      req.user = decoded
      next()
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        logExpiredToken(req.user?.userId || 'unknown', req.ip || 'unknown', req.path)
        throw new AuthenticationError('Token expired')
      }
      logInvalidToken(req.ip || 'unknown', req.path, 'Invalid token')
      throw new AuthenticationError('Invalid token')
    }
  } catch (error) {
    next(error)
  }
}

export const checkRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      logUnauthorizedAccess(
        req.user?.userId || 'unknown',
        req.ip || 'unknown',
        req.path,
        req.method,
        `Required roles: ${allowedRoles.join(', ')}`
      )
      throw new AuthorizationError('Insufficient permissions')
    }
    next()
  }
}
```

### Log Files

Security logs are written to:
- `logs/security.log` - All security events
- `logs/security-critical.log` - Critical security events only (warnings and above)

### Critical Events

The following events are logged as warnings (critical):
- RATE_LIMIT_EXCEEDED
- SUSPICIOUS_ACTIVITY
- SQL_INJECTION_ATTEMPT
- XSS_ATTEMPT
- UNAUTHORIZED_ACCESS

All other events are logged as info level.
