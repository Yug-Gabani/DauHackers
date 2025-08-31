const express = require('express');
const { query, validationResult } = require('express-validator');

const { protect, optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// @desc    Get dashboard overview
// @route   GET /api/dashboard/overview
// @access  Public
router.get('/overview', async (req, res) => {
  try {
    // In a real application, you would aggregate data from your database
    // For now, we'll return mock data
    const overview = {
      totalAlerts: 156,
      activeAlerts: 23,
      criticalAlerts: 5,
      totalUsers: 2847,
      totalReports: 89,
      pendingReports: 12,
      coastalAreas: {
        mumbai: { alerts: 45, users: 856, reports: 23 },
        goa: { alerts: 23, users: 432, reports: 15 },
        kerala: { alerts: 34, users: 567, reports: 18 },
        tamilnadu: { alerts: 28, users: 398, reports: 12 },
        andhra: { alerts: 19, users: 234, reports: 8 },
        odisha: { alerts: 15, users: 189, reports: 6 },
        westbengal: { alerts: 12, users: 156, reports: 4 },
        gujarat: { alerts: 20, users: 245, reports: 3 }
      },
      recentActivity: [
        {
          type: 'alert',
          action: 'created',
          description: 'Storm warning issued for Mumbai coast',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          severity: 'critical'
        },
        {
          type: 'report',
          action: 'submitted',
          description: 'Water pollution reported in Goa',
          timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          priority: 'high'
        },
        {
          type: 'user',
          action: 'registered',
          description: 'New fisherfolk user registered',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        }
      ],
      weatherSummary: {
        mumbai: { temperature: 28, condition: 'Partly Cloudy', windSpeed: 15 },
        goa: { temperature: 30, condition: 'Sunny', windSpeed: 12 },
        kerala: { temperature: 26, condition: 'Rainy', windSpeed: 8 },
        tamilnadu: { temperature: 29, condition: 'Sunny', windSpeed: 18 },
        andhra: { temperature: 31, condition: 'Clear', windSpeed: 14 },
        odisha: { temperature: 27, condition: 'Cloudy', windSpeed: 10 },
        westbengal: { temperature: 25, condition: 'Rainy', windSpeed: 6 },
        gujarat: { temperature: 32, condition: 'Clear', windSpeed: 20 }
      }
    };

    res.json({
      success: true,
      data: overview
    });

  } catch (error) {
    logger.error('Get dashboard overview failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard overview. Please try again.'
    });
  }
});

// @desc    Get alerts summary
// @route   GET /api/dashboard/alerts
// @access  Public
router.get('/alerts', [
  query('coastalArea').optional().isIn(['mumbai', 'goa', 'kerala', 'tamilnadu', 'andhra', 'odisha', 'westbengal', 'gujarat']).withMessage('Invalid coastal area'),
  query('period').optional().isIn(['24h', '7d', '30d', '90d']).withMessage('Invalid period')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { coastalArea, period = '7d' } = req.query;

    // Mock alert summary data
    const alertSummary = {
      total: 156,
      byType: {
        storm: 45,
        tide: 32,
        pollution: 28,
        erosion: 18,
        emergency: 12,
        weather: 21
      },
      bySeverity: {
        info: 67,
        warning: 45,
        critical: 28,
        emergency: 16
      },
      byStatus: {
        active: 23,
        resolved: 98,
        expired: 25,
        cancelled: 10
      },
      byCoastalArea: {
        mumbai: 45,
        goa: 23,
        kerala: 34,
        tamilnadu: 28,
        andhra: 19,
        odisha: 15,
        westbengal: 12,
        gujarat: 20
      },
      recentTrends: [
        { date: '2024-01-01', count: 12 },
        { date: '2024-01-02', count: 15 },
        { date: '2024-01-03', count: 8 },
        { date: '2024-01-04', count: 22 },
        { date: '2024-01-05', count: 18 },
        { date: '2024-01-06', count: 25 },
        { date: '2024-01-07', count: 16 }
      ]
    };

    // Filter by coastal area if specified
    if (coastalArea) {
      alertSummary.total = alertSummary.byCoastalArea[coastalArea] || 0;
    }

    res.json({
      success: true,
      data: alertSummary
    });

  } catch (error) {
    logger.error('Get alerts summary failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve alerts summary. Please try again.'
    });
  }
});

// @desc    Get user statistics
// @route   GET /api/dashboard/users
// @access  Private (Admin, Authority)
router.get('/users', protect, async (req, res) => {
  try {
    // Mock user statistics
    const userStats = {
      total: 2847,
      active: 2654,
      verified: 2412,
      byUserType: {
        fisherfolk: 1245,
        business: 567,
        tourist: 234,
        ngo: 89,
        authority: 156,
        general: 556
      },
      byCoastalArea: {
        mumbai: 856,
        goa: 432,
        kerala: 567,
        tamilnadu: 398,
        andhra: 234,
        odisha: 189,
        westbengal: 156,
        gujarat: 245
      },
      byLanguage: {
        english: 1456,
        hindi: 567,
        marathi: 234,
        gujarati: 189,
        tamil: 156,
        telugu: 123,
        malayalam: 89,
        kannada: 23
      },
      registrationTrends: [
        { month: '2024-01', count: 234 },
        { month: '2024-02', count: 267 },
        { month: '2024-03', count: 298 },
        { month: '2024-04', count: 312 },
        { month: '2024-05', count: 289 },
        { month: '2024-06', count: 345 }
      ]
    };

    res.json({
      success: true,
      data: userStats
    });

  } catch (error) {
    logger.error('Get user statistics failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user statistics. Please try again.'
    });
  }
});

// @desc    Get coastal area specific dashboard
// @route   GET /api/dashboard/coastal-area/:area
// @access  Public
router.get('/coastal-area/:area', [
  query('area').isIn(['mumbai', 'goa', 'kerala', 'tamilnadu', 'andhra', 'odisha', 'westbengal', 'gujarat']).withMessage('Valid coastal area is required')
], async (req, res) => {
  try {
    const { area } = req.params;

    // Mock coastal area specific data
    const coastalAreaData = {
      area,
      overview: {
        totalAlerts: 45,
        activeAlerts: 8,
        criticalAlerts: 2,
        totalUsers: 856,
        totalReports: 23,
        pendingReports: 4
      },
      currentConditions: {
        weather: {
          temperature: 28,
          humidity: 75,
          windSpeed: 15,
          windDirection: 'SE',
          condition: 'Partly Cloudy',
          visibility: 10
        },
        tide: {
          currentLevel: 2.4,
          nextHigh: '14:30',
          nextLow: '08:15',
          nextChange: '2h 15m'
        },
        waterQuality: {
          status: 'Good',
          ph: 7.2,
          turbidity: 'Low',
          dissolvedOxygen: 'High'
        }
      },
      recentAlerts: [
        {
          id: '1',
          type: 'storm',
          severity: 'warning',
          title: 'Storm approaching',
          description: 'Moderate storm expected in next 6 hours',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          id: '2',
          type: 'tide',
          severity: 'info',
          title: 'High tide alert',
          description: 'Unusually high tide expected',
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
        }
      ],
      communityReports: [
        {
          id: '1',
          type: 'pollution',
          priority: 'high',
          description: 'Oil spill spotted near harbor',
          status: 'investigating',
          createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
        }
      ],
      evacuationInfo: {
        shelters: [
          {
            name: 'Community Center',
            address: '123 Beach Road',
            capacity: 200,
            currentOccupancy: 45,
            contact: '+91 98765 43210'
          }
        ],
        routes: [
          {
            name: 'Primary Route',
            description: 'Main evacuation route to higher ground',
            distance: '2.5 km',
            estimatedTime: '15 minutes'
          }
        ]
      }
    };

    res.json({
      success: true,
      data: coastalAreaData
    });

  } catch (error) {
    logger.error('Get coastal area dashboard failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve coastal area dashboard. Please try again.'
    });
  }
});

// @desc    Get system health and performance
// @route   GET /api/dashboard/system-health
// @access  Private (Admin)
router.get('/system-health', protect, async (req, res) => {
  try {
    // Mock system health data
    const systemHealth = {
      status: 'healthy',
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage().heapUsed / 1024 / 1024,
        total: process.memoryUsage().heapTotal / 1024 / 1024,
        external: process.memoryUsage().external / 1024 / 1024
      },
      database: {
        status: 'connected',
        connections: 12,
        responseTime: '45ms'
      },
      externalServices: {
        weatherAPI: { status: 'operational', responseTime: '120ms' },
        smsService: { status: 'operational', responseTime: '200ms' },
        emailService: { status: 'operational', responseTime: '150ms' }
      },
      performance: {
        averageResponseTime: '180ms',
        requestsPerMinute: 45,
        errorRate: '0.2%',
        activeConnections: 23
      },
      alerts: {
        critical: 0,
        warning: 1,
        info: 3
      }
    };

    res.json({
      success: true,
      data: systemHealth
    });

  } catch (error) {
    logger.error('Get system health failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve system health. Please try again.'
    });
  }
});

// @desc    Get real-time monitoring data
// @route   GET /api/dashboard/monitoring
// @access  Private (Admin, Authority)
router.get('/monitoring', protect, async (req, res) => {
  try {
    // Mock real-time monitoring data
    const monitoringData = {
      timestamp: new Date().toISOString(),
      activeAlerts: 23,
      criticalAlerts: 5,
      usersOnline: 156,
      smsQueue: 12,
      emailQueue: 8,
      systemLoad: {
        cpu: 45.2,
        memory: 67.8,
        disk: 23.4
      },
      network: {
        requestsPerSecond: 12.5,
        activeConnections: 89,
        bandwidth: '2.3 MB/s'
      },
      database: {
        activeQueries: 15,
        slowQueries: 2,
        connections: 12
      }
    };

    res.json({
      success: true,
      data: monitoringData
    });

  } catch (error) {
    logger.error('Get monitoring data failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve monitoring data. Please try again.'
    });
  }
});

module.exports = router;
