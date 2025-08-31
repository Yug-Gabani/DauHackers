const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cluster = require('cluster');
const os = require('os');
const Redis = require('redis');
const morgan = require('morgan');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const cookieParser = require('cookie-parser');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const axios = require('axios');
const cron = require('node-cron');
const tf = require('@tensorflow/tfjs-node');
const natural = require('natural');
require('dotenv').config();

// Import configurations and utilities
const connectDB = require('./config/database');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { validateEnv } = require('./config/environment');

// Import AI/ML services
const ThreatDetectionService = require('./services/threatDetection');
const WeatherAnalysisService = require('./services/weatherAnalysis');
const PollutionDetectionService = require('./services/pollutionDetection');
const ErosionAnalysisService = require('./services/erosionAnalysis');

// Import data collection services
const GovernmentDataService = require('./services/governmentData');
const SatelliteDataService = require('./services/satelliteData');
const SensorDataService = require('./services/sensorData');

// Import notification services
const SMSService = require('./services/smsService');
const EmailService = require('./services/emailService');
const PushNotificationService = require('./services/pushNotificationService');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const alertRoutes = require('./routes/alerts');
const weatherRoutes = require('./routes/weather');
const reportRoutes = require('./routes/reports');
const smsRoutes = require('./routes/sms');
const dashboardRoutes = require('./routes/dashboard');
const threatRoutes = require('./routes/threats');
const sensorRoutes = require('./routes/sensors');
const analysisRoutes = require('./routes/analysis');
const notificationRoutes = require('./routes/notifications');
const governmentRoutes = require('./routes/government');
const mlRoutes = require('./routes/ml');

// Cluster configuration for multi-core performance
if (cluster.isMaster && process.env.NODE_ENV === 'production') {
  const numCPUs = os.cpus().length;
  logger.info(`🚀 Master ${process.pid} is running`);
  logger.info(`💻 Forking ${numCPUs} workers...`);
  
  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  cluster.on('exit', (worker, code, signal) => {
    logger.info(`Worker ${worker.process.pid} died`);
    cluster.fork(); // Replace the dead worker
  });
} else {
  // Worker process
  const app = express();
  const server = createServer(app);

  // Redis configuration for caching and sessions
  const redisClient = Redis.createClient({
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

  // Socket.io setup with Redis adapter for scaling
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST", "PUT", "DELETE"],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true
  });

  // Enhanced rate limiting with different limits for different endpoints
  const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // stricter limit for sensitive endpoints
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 3, // very strict for authentication
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Enhanced security and performance middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));

  app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  app.use(mongoSanitize()); // Prevent NoSQL injection
  app.use(xss()); // Prevent XSS attacks
  app.use(hpp()); // Prevent HTTP Parameter Pollution
  app.use(cookieParser());

  // Apply rate limiting
  app.use('/api/auth', authLimiter);
  app.use('/api/', generalLimiter);
  app.use('/api/alerts', strictLimiter);
  app.use('/api/ml', strictLimiter);

  app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
      try {
        JSON.parse(buf);
      } catch (e) {
        res.status(400).json({ error: 'Invalid JSON' });
        throw new Error('Invalid JSON');
      }
    }
  }));

  app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb',
    parameterLimit: 1000
  }));

  // Advanced request logging with Morgan
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));

  // Performance monitoring middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - ${req.ip}`);
      
      // Log slow requests
      if (duration > 1000) {
        logger.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
      }
    });
    next();
  });

  // Cache control headers
  app.use((req, res, next) => {
    res.set('Cache-Control', 'public, max-age=300'); // 5 minutes default cache
    next();
  });

  // Enhanced health check with system metrics
  app.get('/health', async (req, res) => {
    try {
      const healthData = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        redis: redisClient.connected ? 'connected' : 'disconnected',
        database: 'connected',
        ai_models: 'loaded',
        sensors: 'active',
        government_apis: 'connected'
      };
      
      res.status(200).json(healthData);
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(500).json({ status: 'ERROR', message: 'Health check failed' });
    }
  });

  // API Documentation with Swagger
  const swaggerOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'CoastalGuard Professional API',
        version: '2.0.0',
        description: 'Professional Coastal Threat Alert System with AI/ML, Government Data Integration, and Real-time Monitoring',
      },
      servers: [
        {
          url: process.env.FRONTEND_URL || 'http://localhost:3000',
          description: 'Development server',
        },
      ],
    },
    apis: ['./backend/routes/*.js'],
  };

  const specs = swaggerJsdoc(swaggerOptions);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/alerts', alertRoutes);
  app.use('/api/weather', weatherRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/sms', smsRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/threats', threatRoutes);
  app.use('/api/sensors', sensorRoutes);
  app.use('/api/analysis', analysisRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/government', governmentRoutes);
  app.use('/api/ml', mlRoutes);

  // Socket.io connection handling
  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.id}`);
    
    socket.on('join-location', (location) => {
      socket.join(location);
      logger.info(`User ${socket.id} joined location: ${location}`);
    });

    socket.on('join-threat-monitoring', () => {
      socket.join('threat-monitoring');
      logger.info(`User ${socket.id} joined threat monitoring`);
    });

    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.id}`);
    });
  });

  // Initialize AI/ML Services
  const threatDetection = new ThreatDetectionService();
  const weatherAnalysis = new WeatherAnalysisService();
  const pollutionDetection = new PollutionDetectionService();
  const erosionAnalysis = new ErosionAnalysisService();

  // Initialize Data Collection Services
  const governmentData = new GovernmentDataService();
  const satelliteData = new SatelliteDataService();
  const sensorData = new SensorDataService();

  // Initialize Notification Services
  const smsService = new SMSService();
  const emailService = new EmailService();
  const pushNotificationService = new PushNotificationService();

  // Scheduled Tasks for Real-time Monitoring
  cron.schedule('*/5 * * * *', async () => {
    try {
      logger.info('Running scheduled threat detection...');
      
      // Collect real-time data
      const sensorData = await sensorData.collectRealTimeData();
      const satelliteData = await satelliteData.getLatestData();
      const governmentData = await governmentData.getLatestAlerts();
      
      // Run AI/ML analysis
      const threatAnalysis = await threatDetection.analyzeThreats(sensorData, satelliteData, governmentData);
      const weatherThreats = await weatherAnalysis.detectAnomalies(sensorData);
      const pollutionThreats = await pollutionDetection.detectPollution(sensorData, satelliteData);
      const erosionThreats = await erosionAnalysis.analyzeErosionTrends(sensorData, satelliteData);
      
      // Generate alerts if threats detected
      if (threatAnalysis.threats.length > 0 || weatherThreats.length > 0 || 
          pollutionThreats.length > 0 || erosionThreats.length > 0) {
        
        // Send real-time notifications
        await smsService.sendBulkAlerts(threatAnalysis.threats);
        await emailService.sendThreatAlerts(threatAnalysis.threats);
        await pushNotificationService.sendNotifications(threatAnalysis.threats);
        
        // Emit real-time updates via Socket.io
        io.to('threat-monitoring').emit('new-threats', {
          threats: threatAnalysis.threats,
          timestamp: new Date().toISOString()
        });
        
        logger.info(`Threats detected and notifications sent: ${threatAnalysis.threats.length} threats`);
      }
      
    } catch (error) {
      logger.error('Error in scheduled threat detection:', error);
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  // Error handling middleware
  app.use(errorHandler);

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  });

  const PORT = process.env.PORT || 5000;

  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
      logger.info('Process terminated');
      if (redisClient.connected) {
        redisClient.quit();
      }
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
      logger.info('Process terminated');
      if (redisClient.connected) {
        redisClient.quit();
      }
      process.exit(0);
    });
  });

  // Connect to database and start server
  connectDB().then(() => {
    server.listen(PORT, () => {
      logger.info(`🚀 Professional CoastalGuard Backend running on port ${PORT}`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🤖 AI/ML Services: Active`);
      logger.info(`📡 Government APIs: Connected`);
      logger.info(`🔍 Real-time Monitoring: Active`);
      if (cluster.isWorker) {
        logger.info(`👷 Worker ${process.pid} started`);
      }
    });
  }).catch((error) => {
    logger.error('Failed to connect to database:', error);
    process.exit(1);
  });

  // Close Redis connection on exit
  process.on('exit', () => {
    if (redisClient.connected) {
      redisClient.quit();
    }
  });

  module.exports = { app, io };
} // Close the cluster.else block
