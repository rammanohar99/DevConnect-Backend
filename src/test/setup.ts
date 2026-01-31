// Test environment setup
process.env.NODE_ENV = 'test'
process.env.MONGODB_URI = 'mongodb://localhost:27017/devconnect-test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.JWT_SECRET = 'test-jwt-secret-key'
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-token-secret-key'
process.env.JWT_EXPIRES_IN = '15m'
process.env.REFRESH_TOKEN_EXPIRES_IN = '7d'
process.env.CORS_ORIGIN = 'http://localhost:5173'
process.env.PORT = '3001'
process.env.LOG_LEVEL = 'error'

// Optional AWS S3 config (not required for tests)
process.env.AWS_REGION = 'us-east-1'
process.env.AWS_ACCESS_KEY_ID = 'test-key'
process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'
process.env.S3_BUCKET_NAME = 'test-bucket'
