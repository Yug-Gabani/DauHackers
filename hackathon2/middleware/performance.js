const logger = require('../utils/logger');

// Performance monitoring middleware
const performanceMonitor = (req, res, next) => {
  const start = process.hrtime();
  const startTime = Date.now();

  // Add performance headers
  res.set('X-Response-Time', '0ms');
  res.set('X-Process-Time', '0ms');

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const diff = process.hrtime(start);
    const responseTime = diff[0] * 1000 + diff[1] / 1000000;
    const totalTime = Date.now() - startTime;

    // Set performance headers
    res.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
    res.set('X-Process-Time', `${totalTime}ms`);

    // Log performance metrics
    logger.info(`Performance: ${req.method} ${req.path} - Response: ${responseTime.toFixed(2)}ms, Total: ${totalTime}ms`);

    // Log slow requests
    if (responseTime > 1000) {
      logger.warn(`Slow response detected: ${req.method} ${req.path} took ${responseTime.toFixed(2)}ms`);
    }

    // Call original end method
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Memory usage monitoring
const memoryMonitor = (req, res, next) => {
  const memUsage = process.memoryUsage();
  
  // Log memory usage every 100 requests
  if (Math.random() < 0.01) {
    logger.info(`Memory Usage - RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)}MB, Heap: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  }

  // Check for memory leaks
  if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB threshold
    logger.warn(`High memory usage detected: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
  }

  next();
};

// Request size monitoring
const requestSizeMonitor = (req, res, next) => {
  const contentLength = req.headers['content-length'];
  if (contentLength) {
    const sizeInMB = parseInt(contentLength) / 1024 / 1024;
    
    if (sizeInMB > 10) { // 10MB threshold
      logger.warn(`Large request detected: ${sizeInMB.toFixed(2)}MB for ${req.method} ${req.path}`);
    }
  }

  next();
};

// Database query monitoring
const dbQueryMonitor = (req, res, next) => {
  const start = Date.now();
  
  // Monitor database operations
  res.on('finish', () => {
    if (req.dbQueryTime) {
      const queryTime = req.dbQueryTime;
      logger.info(`DB Query: ${req.method} ${req.path} - ${queryTime}ms`);
      
      if (queryTime > 1000) {
        logger.warn(`Slow DB query detected: ${req.method} ${req.path} took ${queryTime}ms`);
      }
    }
  });

  next();
};

// Error rate monitoring
const errorRateMonitor = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      logger.warn(`Error response: ${req.method} ${req.path} - ${res.statusCode}`);
    }
  });

  next();
};

// Combined performance middleware
const performanceMiddleware = [
  performanceMonitor,
  memoryMonitor,
  requestSizeMonitor,
  dbQueryMonitor,
  errorRateMonitor
];

module.exports = {
  performanceMonitor,
  memoryMonitor,
  requestSizeMonitor,
  dbQueryMonitor,
  errorRateMonitor,
  performanceMiddleware
};
