const express = require('express');
const { body, validationResult } = require('express-validator');
const twilio = require('twilio');
const cron = require('node-cron');

const User = require('../models/User');
const Alert = require('../models/Alert');
const { protect, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// SMS templates for different languages
const smsTemplates = {
  english: {
    storm: '🚨 STORM WARNING: {title} - {description} - CoastalGuard',
    tide: '🌊 HIGH TIDE ALERT: {title} - {description} - CoastalGuard',
    pollution: '⚠️ POLLUTION ALERT: {title} - {description} - CoastalGuard',
    erosion: '🏖️ EROSION ALERT: {title} - {description} - CoastalGuard',
    emergency: '🚨 EMERGENCY: {title} - {description} - CoastalGuard',
    weather: '🌤️ WEATHER UPDATE: {title} - {description} - CoastalGuard'
  },
  hindi: {
    storm: '🚨 तूफान चेतावनी: {title} - {description} - CoastalGuard',
    tide: '🌊 उच्च ज्वार चेतावनी: {title} - {description} - CoastalGuard',
    pollution: '⚠️ प्रदूषण चेतावनी: {title} - {description} - CoastalGuard',
    erosion: '🏖️ कटाव चेतावनी: {title} - {description} - CoastalGuard',
    emergency: '🚨 आपातकाल: {title} - {description} - CoastalGuard',
    weather: '🌤️ मौसम अपडेट: {title} - {description} - CoastalGuard'
  },
  marathi: {
    storm: '🚨 वादळ चेतावणी: {title} - {description} - CoastalGuard',
    tide: '🌊 उच्च भरती चेतावणी: {title} - {description} - CoastalGuard',
    pollution: '⚠️ प्रदूषण चेतावणी: {title} - {description} - CoastalGuard',
    erosion: '🏖️ कटाव चेतावणी: {title} - {description} - CoastalGuard',
    emergency: '🚨 आणीबाणी: {title} - {description} - CoastalGuard',
    weather: '🌤️ हवामान अपडेट: {title} - {description} - CoastalGuard'
  },
  gujarati: {
    storm: '🚨 વાવાઝોડું ચેતવણી: {title} - {description} - CoastalGuard',
    tide: '🌊 ઉચ્ચ ભરતી ચેતવણી: {title} - {description} - CoastalGuard',
    pollution: '⚠️ પ્રદૂષણ ચેતવણી: {title} - {description} - CoastalGuard',
    erosion: '🏖️ કટાવ ચેતવણી: {title} - {description} - CoastalGuard',
    emergency: '🚨 કટોકટી: {title} - {description} - CoastalGuard',
    weather: '🌤️ હવામાન અપડેટ: {title} - {description} - CoastalGuard'
  },
  tamil: {
    storm: '🚨 புயல் எச்சரிக்கை: {title} - {description} - CoastalGuard',
    tide: '🌊 உயர் ஓத எச்சரிக்கை: {title} - {description} - CoastalGuard',
    pollution: '⚠️ மாசு எச்சரிக்கை: {title} - {description} - CoastalGuard',
    erosion: '🏖️ அரிப்பு எச்சரிக்கை: {title} - {description} - CoastalGuard',
    emergency: '🚨 அவசரநிலை: {title} - {description} - CoastalGuard',
    weather: '🌤️ வானிலை புதுப்பிப்பு: {title} - {description} - CoastalGuard'
  },
  telugu: {
    storm: '🚨 తుఫాన్ హెచ్చరిక: {title} - {description} - CoastalGuard',
    tide: '🌊 ఎత్తైన ఉప్పెన హెచ్చరిక: {title} - {description} - CoastalGuard',
    pollution: '⚠️ కాలుష్య హెచ్చరిక: {title} - {description} - CoastalGuard',
    erosion: '🏖️ కోత హెచ్చరిక: {title} - {description} - CoastalGuard',
    emergency: '🚨 అత్యవసర పరిస్థితి: {title} - {description} - CoastalGuard',
    weather: '🌤️ వాతావరణ నవీకరణ: {title} - {description} - CoastalGuard'
  },
  malayalam: {
    storm: '🚨 കൊടുങ്കാറ്റ് മുന്നറിയിപ്പ്: {title} - {description} - CoastalGuard',
    tide: '🌊 ഉയർന്ന വേലിയേറ്റ മുന്നറിയിപ്പ്: {title} - {description} - CoastalGuard',
    pollution: '⚠️ മലിനീകരണ മുന്നറിയിപ്പ്: {title} - {description} - CoastalGuard',
    erosion: '🏖️ അപരദന മുന്നറിയിപ്പ്: {title} - {description} - CoastalGuard',
    emergency: '🚨 അടിയന്തിരാവസ്ഥ: {title} - {description} - CoastalGuard',
    weather: '🌤️ കാലാവസ്ഥ അപ്ഡേറ്റ്: {title} - {description} - CoastalGuard'
  },
  kannada: {
    storm: '🚨 ಚಂಡಮಾರುತ ಎಚ್ಚರಿಕೆ: {title} - {description} - CoastalGuard',
    tide: '🌊 ಉನ್ನತ ಭರತಿ ಎಚ್ಚರಿಕೆ: {title} - {description} - CoastalGuard',
    pollution: '⚠️ ಮಾಲಿನ್ಯ ಎಚ್ಚರಿಕೆ: {title} - {description} - CoastalGuard',
    erosion: '🏖️ ಕೊರೆತ ಎಚ್ಚರಿಕೆ: {title} - {description} - CoastalGuard',
    emergency: '🚨 ತುರ್ತು ಪರಿಸ್ಥಿತಿ: {title} - {description} - CoastalGuard',
    weather: '🌤️ ಹವಾಮಾನ ನವೀಕರಣ: {title} - {description} - CoastalGuard'
  }
};

// Helper function to format SMS message
const formatSMSMessage = (alert, language = 'english') => {
  const template = smsTemplates[language] || smsTemplates.english;
  const alertTemplate = template[alert.type] || template.info;
  
  return alertTemplate
    .replace('{title}', alert.title)
    .replace('{description}', alert.description.substring(0, 100) + (alert.description.length > 100 ? '...' : ''));
};

// Helper function to send SMS
const sendSMS = async (to, message) => {
  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });
    
    logger.info(`SMS sent successfully to ${to}: ${result.sid}`);
    return { success: true, sid: result.sid };
  } catch (error) {
    logger.error(`Failed to send SMS to ${to}:`, error);
    return { success: false, error: error.message };
  }
};

// @desc    Send SMS alert to specific users
// @route   POST /api/sms/send
// @access  Private (Admin, Authority)
router.post('/send', protect, authorize('admin', 'authority'), [
  body('alertId').isMongoId().withMessage('Valid alert ID is required'),
  body('userIds').optional().isArray().withMessage('User IDs must be an array'),
  body('coastalArea').optional().isIn(['mumbai', 'goa', 'kerala', 'tamilnadu', 'andhra', 'odisha', 'westbengal', 'gujarat']).withMessage('Invalid coastal area'),
  body('userType').optional().isIn(['fisherfolk', 'business', 'tourist', 'ngo', 'authority', 'general']).withMessage('Invalid user type')
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

    const { alertId, userIds, coastalArea, userType } = req.body;

    // Get the alert
    const alert = await Alert.findById(alertId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Build user filter
    let userFilter = {
      'preferences.smsEnabled': true,
      isActive: true
    };

    if (userIds && userIds.length > 0) {
      userFilter._id = { $in: userIds };
    } else {
      if (coastalArea) {
        userFilter['location.coastalArea'] = coastalArea;
      }
      if (userType) {
        userFilter.userType = userType;
      }
      
      // Check if user wants this type of alert
      userFilter['preferences.alertTypes'] = { $in: [alert.type] };
    }

    // Get users to send SMS to
    const users = await User.find(userFilter).select('phone preferences.language');
    
    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No users found matching the criteria'
      });
    }

    // Send SMS to each user
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const user of users) {
      const message = formatSMSMessage(alert, user.preferences.language);
      const result = await sendSMS(user.phone, message);
      
      results.push({
        userId: user._id,
        phone: user.phone,
        success: result.success,
        sid: result.sid,
        error: result.error
      });

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Update alert statistics
    alert.statistics.totalRecipients += users.length;
    alert.statistics.deliveredCount += successCount;
    await alert.save();

    res.json({
      success: true,
      message: `SMS sent to ${users.length} users. Success: ${successCount}, Failed: ${failureCount}`,
      data: {
        totalUsers: users.length,
        successCount,
        failureCount,
        results
      }
    });

  } catch (error) {
    logger.error('Send SMS failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send SMS. Please try again.'
    });
  }
});

// @desc    Send bulk SMS to all users in a coastal area
// @route   POST /api/sms/bulk
// @access  Private (Admin, Authority)
router.post('/bulk', protect, authorize('admin', 'authority'), [
  body('message').isLength({ min: 1, max: 160 }).withMessage('Message must be between 1 and 160 characters'),
  body('coastalArea').isIn(['mumbai', 'goa', 'kerala', 'tamilnadu', 'andhra', 'odisha', 'westbengal', 'gujarat']).withMessage('Valid coastal area is required'),
  body('userType').optional().isIn(['fisherfolk', 'business', 'tourist', 'ngo', 'authority', 'general']).withMessage('Invalid user type'),
  body('language').optional().isIn(['english', 'hindi', 'marathi', 'gujarati', 'tamil', 'telugu', 'malayalam', 'kannada']).withMessage('Invalid language')
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

    const { message, coastalArea, userType, language = 'english' } = req.body;

    // Build user filter
    let userFilter = {
      'location.coastalArea': coastalArea,
      'preferences.smsEnabled': true,
      isActive: true
    };

    if (userType) {
      userFilter.userType = userType;
    }

    if (language) {
      userFilter['preferences.language'] = language;
    }

    // Get users
    const users = await User.find(userFilter).select('phone name');
    
    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No users found matching the criteria'
      });
    }

    // Send SMS to each user
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const user of users) {
      const result = await sendSMS(user.phone, message);
      
      results.push({
        userId: user._id,
        name: user.name,
        phone: user.phone,
        success: result.success,
        sid: result.sid,
        error: result.error
      });

      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }

      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    res.json({
      success: true,
      message: `Bulk SMS sent to ${users.length} users. Success: ${successCount}, Failed: ${failureCount}`,
      data: {
        totalUsers: users.length,
        successCount,
        failureCount,
        results
      }
    });

  } catch (error) {
    logger.error('Bulk SMS failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send bulk SMS. Please try again.'
    });
  }
});

// @desc    Get SMS delivery status
// @route   GET /api/sms/status/:messageSid
// @access  Private
router.get('/status/:messageSid', protect, async (req, res) => {
  try {
    const { messageSid } = req.params;

    const message = await twilioClient.messages(messageSid).fetch();
    
    res.json({
      success: true,
      data: {
        sid: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        body: message.body,
        dateCreated: message.dateCreated,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage
      }
    });

  } catch (error) {
    logger.error('Get SMS status failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get SMS status. Please try again.'
    });
  }
});

// @desc    Get SMS statistics
// @route   GET /api/sms/stats
// @access  Private (Admin, Authority)
router.get('/stats', protect, authorize('admin', 'authority'), async (req, res) => {
  try {
    const { startDate, endDate, coastalArea } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate);
    }

    // Get user statistics
    const userStats = await User.aggregate([
      { $match: { 'preferences.smsEnabled': true, isActive: true } },
      {
        $group: {
          _id: '$location.coastalArea',
          count: { $sum: 1 },
          userTypes: { $addToSet: '$userType' }
        }
      }
    ]);

    // Get alert statistics
    const alertStats = await Alert.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$type',
          totalAlerts: { $sum: 1 },
          totalRecipients: { $sum: '$statistics.totalRecipients' },
          deliveredCount: { $sum: '$statistics.deliveredCount' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        userStats,
        alertStats,
        totalUsers: userStats.reduce((sum, stat) => sum + stat.count, 0),
        totalAlerts: alertStats.reduce((sum, stat) => sum + stat.totalAlerts, 0),
        totalRecipients: alertStats.reduce((sum, stat) => sum + stat.totalRecipients, 0),
        totalDelivered: alertStats.reduce((sum, stat) => sum + stat.deliveredCount, 0)
      }
    });

  } catch (error) {
    logger.error('Get SMS stats failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get SMS statistics. Please try again.'
    });
  }
});

// @desc    Test SMS functionality
// @route   POST /api/sms/test
// @access  Private (Admin)
router.post('/test', protect, authorize('admin'), [
  body('phone').matches(/^\+?[\d\s-()]+$/).withMessage('Valid phone number is required'),
  body('message').isLength({ min: 1, max: 160 }).withMessage('Message must be between 1 and 160 characters')
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

    const { phone, message } = req.body;

    const result = await sendSMS(phone, message);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Test SMS sent successfully',
        data: { sid: result.sid }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send test SMS',
        data: { error: result.error }
      });
    }

  } catch (error) {
    logger.error('Test SMS failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test SMS. Please try again.'
    });
  }
});

// Scheduled task to send SMS for critical alerts
// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    logger.info('Running scheduled SMS task for critical alerts');
    
    // Get all active critical and emergency alerts
    const criticalAlerts = await Alert.find({
      status: 'active',
      severity: { $in: ['critical', 'emergency'] },
      verificationStatus: 'verified',
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    }).populate('createdBy', 'name');

    for (const alert of criticalAlerts) {
      // Check if we should send SMS (not too frequently)
      const lastSMS = alert.lastSMSSent || new Date(0);
      const hoursSinceLastSMS = (Date.now() - lastSMS.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastSMS >= 1) { // Send at most once per hour
        // Get users in affected area
        const users = await User.find({
          'location.coastalArea': alert.location.coastalArea,
          'preferences.smsEnabled': true,
          'preferences.alertTypes': { $in: [alert.type] },
          isActive: true
        }).select('phone preferences.language');

        // Send SMS to users
        for (const user of users) {
          const message = formatSMSMessage(alert, user.preferences.language);
          await sendSMS(user.phone, message);
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Update alert
        alert.lastSMSSent = new Date();
        await alert.save();
        
        logger.info(`Scheduled SMS sent for alert ${alert._id} to ${users.length} users`);
      }
    }
  } catch (error) {
    logger.error('Scheduled SMS task failed:', error);
  }
});

module.exports = router;
