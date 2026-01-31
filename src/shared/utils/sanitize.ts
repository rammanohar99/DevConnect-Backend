/**
 * Sanitize string input to prevent XSS and injection attacks
 */
export const sanitizeString = (input: string): string => {
  if (typeof input !== 'string') {
    return ''
  }

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers like onclick=
}

/**
 * Sanitize email input
 */
export const sanitizeEmail = (email: string): string => {
  if (typeof email !== 'string') {
    return ''
  }

  return email.trim().toLowerCase()
}

/**
 * Sanitize object by recursively sanitizing all string values
 */
export const sanitizeObject = <T extends Record<string, any>>(obj: T): T => {
  const sanitized: any = {}

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value)
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) => (typeof item === 'string' ? sanitizeString(item) : item))
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized as T
}

/**
 * Validate and sanitize MongoDB ObjectId
 */
export const sanitizeObjectId = (id: string): string => {
  if (typeof id !== 'string') {
    return ''
  }

  // MongoDB ObjectId is 24 hex characters
  const objectIdRegex = /^[0-9a-fA-F]{24}$/
  return objectIdRegex.test(id) ? id : ''
}

/**
 * Sanitize search query
 */
export const sanitizeSearchQuery = (query: string): string => {
  if (typeof query !== 'string') {
    return ''
  }

  return query
    .trim()
    .replace(/[<>]/g, '')
    .replace(/[^\w\s-]/g, '') // Allow only alphanumeric, spaces, and hyphens
    .slice(0, 100) // Limit length
}

/**
 * Sanitize filename for file uploads
 */
export const sanitizeFilename = (filename: string): string => {
  if (typeof filename !== 'string') {
    return ''
  }

  return filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
    .replace(/\.{2,}/g, '.') // Prevent directory traversal
    .slice(0, 255) // Limit length
}
