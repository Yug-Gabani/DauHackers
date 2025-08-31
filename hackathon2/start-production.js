#!/usr/bin/env node

/**
 * Production Startup Script for CoastalGuard
 * This script provides advanced production optimizations including:
 * - Cluster management for multi-core performance
 * - Advanced monitoring and health checks
 * - Graceful shutdown handling
 * - Performance optimization
 * - Security hardening
 */

const cluster = require('cluster');
const os = require('os');
const path = require('path');
const fs = require('fs');

// Load environment variables first
require('dotenv').config();

// Import configurations
const LoadBalancer = require('./config/loadBalancer');
const { validateEnv } = require('./config/environment');

// Validate environment before starting
const env = validateEnv();

// Production optimizations
if (env.NODE_ENV === 'production') {
  // Increase event loop limit
  process.setMaxListeners(0);
  
  // Optimize garbage collection
  if (global.gc) {
    setInterval(() => {
      global.gc();
    }, 30000); // Run GC every 30 seconds
  }
  
  // Set production Node.js flags
  process.env.NODE_OPTIONS = '--max-old-space-size=4096 --optimize-for-size';
}

// Master process management
if (cluster.isMaster && env.ENABLE_CLUSTER) {
  console.log('🚀 Starting CoastalGuard in Production Mode');
  console.log(`💻 Master process ${process.pid} is running`);
  console.log(`🔧 Environment: ${env.NODE_ENV}`);
  console.log(`🌐 Port: ${env.PORT}`);
  console.log(`👥 CPU Cores: ${os.cpus().length}`);
  
  // Initialize load balancer
  const loadBalancer = new LoadBalancer();
  loadBalancer.startMaster();
  
  // Monitor system resources
  setInterval(() => {
    const stats = loadBalancer.getStats();
    if (stats) {
      const memUsage = process.memoryUsage();
      console.log(`📊 System Status - Workers: ${stats.workers.active}/${stats.workers.expected}, Memory: ${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`);
    }
  }, 60000); // Every minute
  
  // Graceful shutdown for master
  process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down master process');
    loadBalancer.shutdownGracefully();
  });
  
  process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down master process');
    loadBalancer.shutdownGracefully();
  });
  
} else {
  // Worker process
  console.log(`👷 Worker ${process.pid} starting...`);
  
  // Handle worker-specific shutdown
  process.on('message', (msg) => {
    if (msg === 'shutdown') {
      console.log(`👷 Worker ${process.pid} shutting down gracefully`);
      process.exit(0);
    } else if (msg === 'health-check') {
      // Send health status back to master
      process.send({
        type: 'health',
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      });
    }
  });
  
  // Start the actual server
  startWorker();
}

async function startWorker() {
  try {
    // Import and start server
    const { app, io } = require('./server');
    
    console.log(`✅ Worker ${process.pid} started successfully`);
    
    // Handle worker-specific errors
    process.on('uncaughtException', (error) => {
      console.error(`💥 Uncaught Exception in Worker ${process.pid}:`, error);
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error(`💥 Unhandled Rejection in Worker ${process.pid}:`, reason);
      process.exit(1);
    });
    
  } catch (error) {
    console.error(`💥 Failed to start worker ${process.pid}:`, error);
    process.exit(1);
  }
}

// Handle process errors
process.on('exit', (code) => {
  console.log(`🔄 Process ${process.pid} exiting with code ${code}`);
});

process.on('warning', (warning) => {
  console.warn(`⚠️ Process ${process.pid} warning:`, warning.name, warning.message);
});

// Performance monitoring
if (env.ENABLE_METRICS) {
  const metrics = {
    startTime: Date.now(),
    requests: 0,
    errors: 0,
    memory: []
  };
  
  // Collect metrics every 5 minutes
  setInterval(() => {
    const memUsage = process.memoryUsage();
    metrics.memory.push({
      timestamp: Date.now(),
      rss: memUsage.rss,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal
    });
    
    // Keep only last 100 memory readings
    if (metrics.memory.length > 100) {
      metrics.memory.shift();
    }
    
    // Log metrics
    console.log(`📊 Worker ${process.pid} Metrics:`, {
      uptime: process.uptime(),
      memory: {
        rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`,
        heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`
      }
    });
  }, 300000); // 5 minutes
}
