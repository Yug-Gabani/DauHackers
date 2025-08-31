const Joi = require('joi');
const logger = require('../utils/logger');

// Environment validation schema
const envSchema = Joi.object({
  // Server Configuration
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(3000),
  FRONTEND_URL: Joi.string().uri().default('http://localhost:3000'),
  
  // Database Configuration
  MONGODB_URI: Joi.string().required(),
  MONGODB_MAX_POOL_SIZE: Joi.number().min(1).max(100).default(10),
  MONGODB_MIN_POOL_SIZE: Joi.number().min(1).max(50).default(2),
  
  // Redis Configuration
  REDIS_URL: Joi.string().uri().default('redis://localhost:6379'),
  REDIS_TTL: Joi.number().min(60).max(86400).default(3600), // 1 hour default
  
  // JWT Configuration
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRE: Joi.string().default('7d'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRE: Joi.string().default('30d'),
  
  // Security Configuration
  BCRYPT_ROUNDS: Joi.number().min(10).max(16).default(12),
  RATE_LIMIT_WINDOW: Joi.number().min(60000).max(900000).default(900000), // 15 minutes
  RATE_LIMIT_MAX: Joi.number().min(10).max(1000).default(100),
  
  // File Upload Configuration
  MAX_FILE_SIZE: Joi.number().min(1024 * 1024).max(50 * 1024 * 1024).default(10 * 1024 * 1024), // 10MB
  ALLOWED_FILE_TYPES: Joi.string().default('image/jpeg,image/png,image/gif,video/mp4,application/pdf'),
  
  // External APIs
  TWILIO_ACCOUNT_SID: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  TWILIO_AUTH_TOKEN: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  OPENWEATHER_API_KEY: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  
  // Email Configuration
  SMTP_HOST: Joi.string().default('smtp.gmail.com'),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_USER: Joi.string().email().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  SMTP_PASS: Joi.string().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  
  // Logging Configuration
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FILE: Joi.string().default('./logs/app.log'),
  
  // Performance Configuration
  ENABLE_CACHE: Joi.boolean().default(true),
  CACHE_TTL: Joi.number().min(60).max(86400).default(300), // 5 minutes
  ENABLE_COMPRESSION: Joi.boolean().default(true),
  COMPRESSION_LEVEL: Joi.number().min(1).max(9).default(6),
  
  // Monitoring Configuration
  ENABLE_METRICS: Joi.boolean().default(true),
  METRICS_PORT: Joi.number().port().default(9090),
  
  // Cluster Configuration
  ENABLE_CLUSTER: Joi.boolean().default(true),
  CLUSTER_WORKERS: Joi.number().min(1).max(16).default('auto'),
  
  // SSL Configuration (for production)
  SSL_ENABLED: Joi.boolean().default(false),
  SSL_KEY_PATH: Joi.string().when('SSL_ENABLED', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  SSL_CERT_PATH: Joi.string().when('SSL_ENABLED', {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional()
  })
});

// Validate and load environment variables
const validateEnv = () => {
  try {
    const { error, value } = envSchema.validate(process.env, {
      allowUnknown: true,
      stripUnknown: true
    });

    if (error) {
      logger.error('Environment validation failed:', error.details);
      process.exit(1);
    }

    // Set optimized defaults based on environment
    if (value.NODE_ENV === 'production') {
      value.ENABLE_CLUSTER = true;
      value.ENABLE_CACHE = true;
      value.ENABLE_COMPRESSION = true;
      value.LOG_LEVEL = 'warn';
      value.BCRYPT_ROUNDS = 14;
      value.RATE_LIMIT_MAX = 50;
    } else if (value.NODE_ENV === 'development') {
      value.ENABLE_CLUSTER = false;
      value.ENABLE_CACHE = false;
      value.LOG_LEVEL = 'debug';
      value.BCRYPT_ROUNDS = 10;
    }

    // Auto-detect cluster workers if not specified
    if (value.CLUSTER_WORKERS === 'auto') {
      const os = require('os');
      value.CLUSTER_WORKERS = os.cpus().length;
    }

    logger.info('✅ Environment configuration validated successfully');
    logger.info(`🌍 Environment: ${value.NODE_ENV}`);
    logger.info(`🔧 Port: ${value.PORT}`);
    logger.info(`👥 Cluster Workers: ${value.CLUSTER_WORKERS}`);
    logger.info(`💾 Cache Enabled: ${value.ENABLE_CACHE}`);
    logger.info(`📊 Compression Enabled: ${value.ENABLE_COMPRESSION}`);

    return value;
  } catch (error) {
    logger.error('Failed to validate environment:', error);
    process.exit(1);
  }
};

// Get environment variable with fallback
const getEnv = (key, fallback = null) => {
  const value = process.env[key];
  if (value === undefined || value === null) {
    if (fallback !== null) {
      return fallback;
    }
    logger.warn(`Environment variable ${key} is not set`);
    return null;
  }
  return value;
};

// Check if environment is production
const isProduction = () => process.env.NODE_ENV === 'production';

// Check if environment is development
const isDevelopment = () => process.env.NODE_ENV === 'development';

// Check if environment is test
const isTest = () => process.env.NODE_ENV === 'test';

module.exports = {
  validateEnv,
  getEnv,
  isProduction,
  isDevelopment,
  isTest
};
