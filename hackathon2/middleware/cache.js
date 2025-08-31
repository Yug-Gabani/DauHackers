const redis = require('redis');
const logger = require('../utils/logger');

// Create Redis client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  retry_strategy: function(options) {
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      return undefined;
    }
    return Math.min(options.attempt * 100, 3000);
  }
});

redisClient.on('error', (err) => logger.error('Redis Client Error', err));
redisClient.on('connect', () => logger.info('Redis Client Connected'));

// Cache middleware
const cache = (duration = 300) => {
  return async (req, res, next) => {
    try {
      // Skip cache for non-GET requests
      if (req.method !== 'GET') {
        return next();
      }

      // Create cache key from URL and query parameters
      const key = `cache:${req.originalUrl || req.url}`;
      
      // Try to get cached response
      const cachedResponse = await redisClient.get(key);
      
      if (cachedResponse) {
        const data = JSON.parse(cachedResponse);
        logger.info(`Cache hit for ${key}`);
        return res.json(data);
      }

      // Store original send method
      const originalSend = res.json;
      
      // Override send method to cache response
      res.json = function(data) {
        // Cache the response
        redisClient.setex(key, duration, JSON.stringify(data))
          .catch(err => logger.error('Cache set error:', err));
        
        // Call original send method
        return originalSend.call(this, data);
      };

      logger.info(`Cache miss for ${key}`);
      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
};

// Clear cache for specific patterns
const clearCache = async (pattern) => {
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      logger.info(`Cleared ${keys.length} cache keys for pattern: ${pattern}`);
    }
  } catch (error) {
    logger.error('Cache clear error:', error);
  }
};

// Clear all cache
const clearAllCache = async () => {
  try {
    await redisClient.flushdb();
    logger.info('All cache cleared');
  } catch (error) {
    logger.error('Clear all cache error:', error);
  }
};

// Cache statistics
const getCacheStats = async () => {
  try {
    const info = await redisClient.info();
    const keys = await redisClient.dbsize();
    return { info, keys };
  } catch (error) {
    logger.error('Cache stats error:', error);
    return { info: null, keys: 0 };
  }
};

module.exports = {
  cache,
  clearCache,
  clearAllCache,
  getCacheStats,
  redisClient
};
