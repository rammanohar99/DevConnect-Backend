import * as fc from 'fast-check'
import { isFileTypeAllowed, isFileSizeAllowed } from '../s3'
import { config } from '../env'

// Feature: devconnect-pro-platform, Property 8: Invalid file uploads are rejected
// Feature: devconnect-pro-platform, Property 40: Valid file uploads succeed
describe('File Validation Property Tests', () => {
  describe('Property 8: Invalid file uploads are rejected', () => {
    it('should reject files with disallowed MIME types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'application/pdf',
            'application/zip',
            'text/plain',
            'application/javascript',
            'text/html',
            'video/mp4',
            'audio/mpeg',
            'application/octet-stream'
          ),
          async (invalidMimetype) => {
            // Ensure this mimetype is not in allowed list
            fc.pre(!config.upload.allowedFileTypes.includes(invalidMimetype))

            const result = isFileTypeAllowed(invalidMimetype)
            expect(result).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should reject files exceeding size limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: config.upload.maxFileSize + 1, max: config.upload.maxFileSize * 10 }),
          async (oversizedFileSize) => {
            const result = isFileSizeAllowed(oversizedFileSize)
            expect(result).toBe(false)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should reject files with zero or negative size', async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: -1000, max: -1 }), async (invalidSize) => {
          const result = isFileSizeAllowed(invalidSize)
          expect(result).toBe(false)
        }),
        { numRuns: 100 }
      )
    })
  })

  describe('Property 40: Valid file uploads succeed', () => {
    it('should accept files with allowed MIME types', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...config.upload.allowedFileTypes),
          async (validMimetype) => {
            const result = isFileTypeAllowed(validMimetype)
            expect(result).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should accept files within size limit', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: config.upload.maxFileSize }),
          async (validFileSize) => {
            const result = isFileSizeAllowed(validFileSize)
            expect(result).toBe(true)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should accept files at exact size limit boundary', async () => {
      const result = isFileSizeAllowed(config.upload.maxFileSize)
      expect(result).toBe(true)
    })

    it('should validate file type and size combinations correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            mimetype: fc.oneof(
              fc.constantFrom(...config.upload.allowedFileTypes),
              fc.constantFrom('application/pdf', 'text/plain', 'video/mp4')
            ),
            size: fc.integer({ min: 0, max: config.upload.maxFileSize * 2 }),
          }),
          async ({ mimetype, size }) => {
            const typeAllowed = isFileTypeAllowed(mimetype)
            const sizeAllowed = isFileSizeAllowed(size)

            // Both must be true for upload to succeed
            const shouldSucceed = typeAllowed && sizeAllowed

            // Verify consistency
            if (
              config.upload.allowedFileTypes.includes(mimetype) &&
              size > 0 &&
              size <= config.upload.maxFileSize
            ) {
              expect(shouldSucceed).toBe(true)
            } else {
              expect(shouldSucceed).toBe(false)
            }
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
