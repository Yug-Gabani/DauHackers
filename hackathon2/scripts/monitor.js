#!/usr/bin/env node

/**
 * CoastalGuard Monitoring Script
 * Provides real-time monitoring of system performance, health, and metrics
 */

const axios = require('axios');
const os = require('os');
const fs = require('fs');
const path = require('path');

class SystemMonitor {
  constructor() {
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    this.interval = process.env.MONITOR_INTERVAL || 5000; // 5 seconds
    this.logFile = path.join(__dirname, '../logs/monitor.log');
    this.metrics = {
      startTime: Date.now(),
      requests: 0,
      errors: 0,
      responseTimes: [],
      memory: [],
      cpu: []
    };
  }

  // Initialize monitoring
  async init() {
    console.log('🔍 Starting CoastalGuard System Monitor');
    console.log(`🌐 Base URL: ${this.baseUrl}`);
    console.log(`⏱️  Monitor Interval: ${this.interval}ms`);
    
    // Create logs directory if it doesn't exist
    const logsDir = path.dirname(this.logFile);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Start monitoring
    this.startMonitoring();
  }

  // Start monitoring loop
  startMonitoring() {
    setInterval(async () => {
      await this.collectMetrics();
    }, this.interval);
  }

  // Collect system metrics
  async collectMetrics() {
    try {
      const timestamp = Date.now();
      
      // System metrics
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.metrics.memory.push({
        timestamp,
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      });
      
      this.metrics.cpu.push({
        timestamp,
        user: cpuUsage.user,
        system: cpuUsage.system
      });
      
      // Keep only last 1000 readings
      if (this.metrics.memory.length > 1000) {
        this.metrics.memory.shift();
        this.metrics.cpu.shift();
      }
      
      // Health check
      await this.healthCheck();
      
      // Performance check
      await this.performanceCheck();
      
      // Log metrics
      this.logMetrics();
      
    } catch (error) {
      console.error('❌ Error collecting metrics:', error.message);
      this.metrics.errors++;
    }
  }

  // Health check
  async healthCheck() {
    try {
      const start = Date.now();
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 5000
      });
      const responseTime = Date.now() - start;
      
      this.metrics.requests++;
      this.metrics.responseTimes.push(responseTime);
      
      if (this.metrics.responseTimes.length > 100) {
        this.metrics.responseTimes.shift();
      }
      
      const status = response.data;
      console.log(`✅ Health Check - Status: ${status.status}, Response Time: ${responseTime}ms`);
      
      // Check critical metrics
      if (status.memory && status.memory.heapUsed > 500 * 1024 * 1024) { // 500MB
        console.warn(`⚠️  High Memory Usage: ${(status.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      }
      
      if (status.uptime > 86400) { // 24 hours
        console.log(`🔄 Uptime: ${(status.uptime / 3600).toFixed(1)} hours`);
      }
      
    } catch (error) {
      console.error(`❌ Health Check Failed: ${error.message}`);
      this.metrics.errors++;
    }
  }

  // Performance check
  async performanceCheck() {
    try {
      // Test API endpoints
      const endpoints = [
        '/api/dashboard/overview',
        '/api/alerts',
        '/api/weather/current',
        '/api/reports'
      ];
      
      for (const endpoint of endpoints) {
        try {
          const start = Date.now();
          await axios.get(`${this.baseUrl}${endpoint}`, {
            timeout: 10000
          });
          const responseTime = Date.now() - start;
          
          if (responseTime > 1000) {
            console.warn(`🐌 Slow Response: ${endpoint} took ${responseTime}ms`);
          }
        } catch (error) {
          console.error(`❌ Endpoint Failed: ${endpoint} - ${error.message}`);
        }
      }
      
    } catch (error) {
      console.error('❌ Performance Check Failed:', error.message);
    }
  }

  // Log metrics
  logMetrics() {
    const timestamp = new Date().toISOString();
    const memUsage = process.memoryUsage();
    const avgResponseTime = this.metrics.responseTimes.length > 0 
      ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length 
      : 0;
    
    const logEntry = {
      timestamp,
      metrics: {
        requests: this.metrics.requests,
        errors: this.metrics.errors,
        avgResponseTime: Math.round(avgResponseTime),
        memory: {
          rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)}MB`,
          heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
          heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`
        },
        system: {
          loadAverage: os.loadavg(),
          uptime: os.uptime(),
          freeMemory: `${(os.freemem() / 1024 / 1024).toFixed(2)}MB`,
          totalMemory: `${(os.totalmem() / 1024 / 1024).toFixed(2)}MB`
        }
      }
    };
    
    // Write to log file
    fs.appendFileSync(this.logFile, JSON.stringify(logEntry) + '\n');
    
    // Console output
    console.log(`📊 Metrics - Requests: ${this.metrics.requests}, Errors: ${this.metrics.errors}, Avg Response: ${Math.round(avgResponseTime)}ms`);
  }

  // Generate report
  generateReport() {
    const uptime = Date.now() - this.metrics.startTime;
    const hours = Math.floor(uptime / (1000 * 60 * 60));
    const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    
    const avgResponseTime = this.metrics.responseTimes.length > 0 
      ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length 
      : 0;
    
    const errorRate = this.metrics.requests > 0 
      ? (this.metrics.errors / this.metrics.requests * 100).toFixed(2) 
      : 0;
    
    console.log('\n📋 Monitoring Report');
    console.log('==================');
    console.log(`⏱️  Monitoring Duration: ${hours}h ${minutes}m`);
    console.log(`📡 Total Requests: ${this.metrics.requests}`);
    console.log(`❌ Total Errors: ${this.metrics.errors}`);
    console.log(`📊 Error Rate: ${errorRate}%`);
    console.log(`⚡ Average Response Time: ${Math.round(avgResponseTime)}ms`);
    console.log(`💾 Memory Usage: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)}MB`);
    console.log(`🖥️  CPU Load: ${os.loadavg().map(load => load.toFixed(2)).join(', ')}`);
    console.log(`🔄 System Uptime: ${(os.uptime() / 3600).toFixed(1)} hours`);
  }

  // Cleanup
  cleanup() {
    console.log('\n🛑 Stopping monitor...');
    this.generateReport();
    process.exit(0);
  }
}

// Main execution
async function main() {
  const monitor = new SystemMonitor();
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    monitor.cleanup();
  });
  
  process.on('SIGTERM', () => {
    monitor.cleanup();
  });
  
  try {
    await monitor.init();
  } catch (error) {
    console.error('❌ Failed to initialize monitor:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = SystemMonitor;
