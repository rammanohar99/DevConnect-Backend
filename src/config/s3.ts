import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommandInput,
  DeleteObjectCommandInput,
  GetObjectCommandInput,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { config } from './env'
import logger from '../shared/utils/logger'
import { v4 as uuidv4 } from 'uuid'

// Initialize S3 client
let s3Client: S3Client | null = null

export const initializeS3Client = (): S3Client | null => {
  // Check if AWS credentials are configured
  if (
    !config.aws.region ||
    !config.aws.accessKeyId ||
    !config.aws.secretAccessKey ||
    !config.aws.s3BucketName
  ) {
    logger.warn('AWS S3 configuration incomplete. File upload features will be disabled.')
    return null
  }

  try {
    s3Client = new S3Client({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      },
    })

    logger.info('S3 client initialized successfully', {
      region: config.aws.region,
      bucket: config.aws.s3BucketName,
    })

    return s3Client
  } catch (error) {
    logger.error('Failed to initialize S3 client', { error })
    return null
  }
}

export const getS3Client = (): S3Client | null => {
  if (!s3Client) {
    return initializeS3Client()
  }
  return s3Client
}

/**
 * Upload a file to S3
 * @param file - File buffer
 * @param filename - Original filename
 * @param mimetype - File MIME type
 * @param folder - Optional folder path in S3 bucket
 * @returns Public URL of uploaded file
 */
export const uploadFile = async (
  file: Buffer,
  filename: string,
  mimetype: string,
  folder: string = 'uploads'
): Promise<string> => {
  const client = getS3Client()

  if (!client || !config.aws.s3BucketName) {
    throw new Error('S3 client not configured. Please set AWS credentials.')
  }

  try {
    // Generate unique filename to avoid collisions
    const fileExtension = filename.split('.').pop()
    const uniqueFilename = `${folder}/${uuidv4()}.${fileExtension}`

    const params: PutObjectCommandInput = {
      Bucket: config.aws.s3BucketName,
      Key: uniqueFilename,
      Body: file,
      ContentType: mimetype,
      // Make file publicly readable
      ACL: 'public-read',
    }

    const command = new PutObjectCommand(params)
    await client.send(command)

    // Construct public URL
    const fileUrl = `https://${config.aws.s3BucketName}.s3.${config.aws.region}.amazonaws.com/${uniqueFilename}`

    logger.info('File uploaded to S3', {
      filename: uniqueFilename,
      mimetype,
      size: file.length,
    })

    return fileUrl
  } catch (error) {
    logger.error('Error uploading file to S3', { filename, error })
    throw new Error('Failed to upload file to S3')
  }
}

/**
 * Delete a file from S3
 * @param fileUrl - Full URL of the file to delete
 */
export const deleteFile = async (fileUrl: string): Promise<void> => {
  const client = getS3Client()

  if (!client || !config.aws.s3BucketName) {
    throw new Error('S3 client not configured. Please set AWS credentials.')
  }

  try {
    // Extract key from URL
    const url = new URL(fileUrl)
    const key = url.pathname.substring(1) // Remove leading slash

    const params: DeleteObjectCommandInput = {
      Bucket: config.aws.s3BucketName,
      Key: key,
    }

    const command = new DeleteObjectCommand(params)
    await client.send(command)

    logger.info('File deleted from S3', { key })
  } catch (error) {
    logger.error('Error deleting file from S3', { fileUrl, error })
    throw new Error('Failed to delete file from S3')
  }
}

/**
 * Generate a signed URL for private file access
 * @param fileKey - S3 object key
 * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns Signed URL
 */
export const getSignedFileUrl = async (
  fileKey: string,
  expiresIn: number = 3600
): Promise<string> => {
  const client = getS3Client()

  if (!client || !config.aws.s3BucketName) {
    throw new Error('S3 client not configured. Please set AWS credentials.')
  }

  try {
    const params: GetObjectCommandInput = {
      Bucket: config.aws.s3BucketName,
      Key: fileKey,
    }

    const command = new GetObjectCommand(params)
    const signedUrl = await getSignedUrl(client, command, { expiresIn })

    logger.debug('Generated signed URL', { fileKey, expiresIn })

    return signedUrl
  } catch (error) {
    logger.error('Error generating signed URL', { fileKey, error })
    throw new Error('Failed to generate signed URL')
  }
}

/**
 * Check if S3 is configured and available
 * @returns true if S3 is configured, false otherwise
 */
export const isS3Configured = (): boolean => {
  return (
    !!config.aws.region &&
    !!config.aws.accessKeyId &&
    !!config.aws.secretAccessKey &&
    !!config.aws.s3BucketName
  )
}

/**
 * Validate file type against allowed types
 * @param mimetype - File MIME type
 * @returns true if file type is allowed
 */
export const isFileTypeAllowed = (mimetype: string): boolean => {
  return config.upload.allowedFileTypes.includes(mimetype)
}

/**
 * Validate file size against maximum allowed size
 * @param size - File size in bytes
 * @returns true if file size is within limit
 */
export const isFileSizeAllowed = (size: number): boolean => {
  return size > 0 && size <= config.upload.maxFileSize
}
