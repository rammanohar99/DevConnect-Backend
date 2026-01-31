import winston from 'winston'
import path from 'path'

/**
 * Security event types
 */
export enum SecurityEventType {
  FAILED_LOGIN = 'FAILED_LOGIN',
  SUCCESSFUL_LOGIN = 'SUCCESSFUL_LOGIN',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  ROLE_CHANGED = 'ROLE_CHANGED',
  CONTENT_MODERATED = 'CONTENT_MODERATED',
  INVALID_INPUT = 'INVALID_INPUT',
  SQL_INJECTION_ATTEMPT = 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT = 'XSS_ATTEMPT',
}

/**
 * Security event metadata interface
 */
export interface SecurityEventMetadata {
  userId?: string
  username?: string
  email?: string
  ip?: string
  userAgent?: string
  path?: string
  method?: string
  statusCode?: number
  reason?: string
  details?: Record<string, any>
  timestamp?: Date
}

/**
 * Security logger configuration
 */
const securityLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...metadata } = info
    return JSON.stringify({
      timestamp,
      level,
      message,
      ...metadata,
    })
  })
)

/**
 * Create security logger instance
 */
const securityLogger = winston.createLogger({
  level: 'info',
  format: securityLogFormat,
  transports: [
    // Security events log file
    new winston.transports.File({
      filename: path.join('logs', 'security.log'),
      level: 'info',
    }),
    // Critical security events log file
    new winston.transports.File({
      filename: path.join('logs', 'security-critical.log'),
      level: 'warn',
    }),
    // Console output in development
    ...(process.env.NODE_ENV !== 'production'
      ? [
          new winston.transports.Console({
            format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
          }),
        ]
      : []),
  ],
})

/**
 * Log a security event
 */
export const logSecurityEvent = (
  eventType: SecurityEventType,
  metadata: SecurityEventMetadata
): void => {
  const logData = {
    eventType,
    timestamp: new Date().toISOString(),
    ...metadata,
  }

  // Determine log level based on event type
  const criticalEvents = [
    SecurityEventType.RATE_LIMIT_EXCEEDED,
    SecurityEventType.SUSPICIOUS_ACTIVITY,
    SecurityEventType.SQL_INJECTION_ATTEMPT,
    SecurityEventType.XSS_ATTEMPT,
    SecurityEventType.UNAUTHORIZED_ACCESS,
  ]

  if (criticalEvents.includes(eventType)) {
    securityLogger.warn(`Security Event: ${eventType}`, logData)
  } else {
    securityLogger.info(`Security Event: ${eventType}`, logData)
  }
}

/**
 * Log failed authentication attempt
 */
export const logFailedLogin = (
  email: string,
  ip: string,
  userAgent?: string,
  reason?: string
): void => {
  logSecurityEvent(SecurityEventType.FAILED_LOGIN, {
    email,
    ip,
    userAgent,
    reason: reason || 'Invalid credentials',
  })
}

/**
 * Log successful authentication
 */
export const logSuccessfulLogin = (
  userId: string,
  email: string,
  ip: string,
  userAgent?: string
): void => {
  logSecurityEvent(SecurityEventType.SUCCESSFUL_LOGIN, {
    userId,
    email,
    ip,
    userAgent,
  })
}

/**
 * Log rate limit violation
 */
export const logRateLimitExceeded = (
  ip: string,
  path: string,
  method: string,
  userId?: string
): void => {
  logSecurityEvent(SecurityEventType.RATE_LIMIT_EXCEEDED, {
    ip,
    path,
    method,
    userId,
    reason: 'Rate limit exceeded',
  })
}

/**
 * Log invalid token attempt
 */
export const logInvalidToken = (
  ip: string,
  path: string,
  reason: string,
  userId?: string
): void => {
  logSecurityEvent(SecurityEventType.INVALID_TOKEN, {
    ip,
    path,
    userId,
    reason,
  })
}

/**
 * Log expired token attempt
 */
export const logExpiredToken = (userId: string, ip: string, path: string): void => {
  logSecurityEvent(SecurityEventType.EXPIRED_TOKEN, {
    userId,
    ip,
    path,
    reason: 'Token expired',
  })
}

/**
 * Log unauthorized access attempt
 */
export const logUnauthorizedAccess = (
  userId: string,
  ip: string,
  path: string,
  method: string,
  reason?: string
): void => {
  logSecurityEvent(SecurityEventType.UNAUTHORIZED_ACCESS, {
    userId,
    ip,
    path,
    method,
    reason: reason || 'Insufficient permissions',
  })
}

/**
 * Log suspicious activity pattern
 */
export const logSuspiciousActivity = (
  ip: string,
  pattern: string,
  details: Record<string, any>,
  userId?: string
): void => {
  logSecurityEvent(SecurityEventType.SUSPICIOUS_ACTIVITY, {
    ip,
    userId,
    reason: pattern,
    details,
  })
}

/**
 * Log account creation
 */
export const logAccountCreated = (
  userId: string,
  email: string,
  ip: string,
  userAgent?: string
): void => {
  logSecurityEvent(SecurityEventType.ACCOUNT_CREATED, {
    userId,
    email,
    ip,
    userAgent,
  })
}

/**
 * Log password change
 */
export const logPasswordChanged = (userId: string, email: string, ip: string): void => {
  logSecurityEvent(SecurityEventType.PASSWORD_CHANGED, {
    userId,
    email,
    ip,
  })
}

/**
 * Log role change (admin action)
 */
export const logRoleChanged = (
  adminId: string,
  targetUserId: string,
  oldRole: string,
  newRole: string,
  ip: string
): void => {
  logSecurityEvent(SecurityEventType.ROLE_CHANGED, {
    userId: adminId,
    ip,
    details: {
      targetUserId,
      oldRole,
      newRole,
    },
  })
}

/**
 * Log content moderation action
 */
export const logContentModerated = (
  moderatorId: string,
  contentType: string,
  contentId: string,
  action: string,
  ip: string
): void => {
  logSecurityEvent(SecurityEventType.CONTENT_MODERATED, {
    userId: moderatorId,
    ip,
    details: {
      contentType,
      contentId,
      action,
    },
  })
}

/**
 * Log invalid input (potential injection attempt)
 */
export const logInvalidInput = (
  ip: string,
  path: string,
  field: string,
  value: string,
  reason: string
): void => {
  logSecurityEvent(SecurityEventType.INVALID_INPUT, {
    ip,
    path,
    reason,
    details: {
      field,
      value: value.substring(0, 100), // Truncate for logging
    },
  })
}

/**
 * Log SQL injection attempt
 */
export const logSQLInjectionAttempt = (
  ip: string,
  path: string,
  field: string,
  value: string
): void => {
  logSecurityEvent(SecurityEventType.SQL_INJECTION_ATTEMPT, {
    ip,
    path,
    reason: 'Potential SQL injection detected',
    details: {
      field,
      value: value.substring(0, 100), // Truncate for logging
    },
  })
}

/**
 * Log XSS attempt
 */
export const logXSSAttempt = (ip: string, path: string, field: string, value: string): void => {
  logSecurityEvent(SecurityEventType.XSS_ATTEMPT, {
    ip,
    path,
    reason: 'Potential XSS attack detected',
    details: {
      field,
      value: value.substring(0, 100), // Truncate for logging
    },
  })
}

export default securityLogger
