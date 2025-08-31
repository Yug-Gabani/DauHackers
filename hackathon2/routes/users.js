const express = require('express');
const { body, query, validationResult } = require('express-validator');

const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private (Admin)
router.get('/', protect, authorize('admin'), [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('role').optional().isIn(['user', 'fisherfolk', 'business', 'authority', 'admin']).withMessage('Invalid role'),
  query('userType').optional().isIn(['fisherfolk', 'business', 'tourist', 'ngo', 'authority', 'general']).withMessage('Invalid user type'),
  query('coastalArea').optional().isIn(['mumbai', 'goa', 'kerala', 'tamilnadu', 'andhra', 'odisha', 'westbengal', 'gujarat']).withMessage('Invalid coastal area'),
  query('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
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

    const {
      page = 1,
      limit = 20,
      role,
      userType,
      coastalArea,
      isActive
    } = req.query;

    // Build filter
    const filter = {};
    if (role) filter.role = role;
    if (userType) filter.userType = userType;
    if (coastalArea) filter['location.coastalArea'] = coastalArea;
    if (isActive !== undefined) filter.isActive = isActive;

    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get users failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users. Please try again.'
    });
  }
});

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Private (Admin, or user themselves)
router.get('/:id', protect, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user can access this profile
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this user profile'
      });
    }

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    logger.error('Get user by ID failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user. Please try again.'
    });
  }
});

// @desc    Update user (Admin or user themselves)
// @route   PUT /api/users/:id
// @access  Private
router.put('/:id', protect, [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  body('phone').optional().matches(/^\+?[\d\s-()]+$/).withMessage('Please provide a valid phone number'),
  body('role').optional().isIn(['user', 'fisherfolk', 'business', 'authority', 'admin']).withMessage('Invalid role'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('preferences.language').optional().isIn(['english', 'hindi', 'marathi', 'gujarati', 'tamil', 'telugu', 'malayalam', 'kannada']).withMessage('Invalid language'),
  body('preferences.alertTypes').optional().isArray().withMessage('Alert types must be an array'),
  body('preferences.smsEnabled').optional().isBoolean().withMessage('SMS enabled must be a boolean'),
  body('preferences.emailEnabled').optional().isBoolean().withMessage('Email enabled must be a boolean')
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

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this user'
      });
    }

    // Only admins can change roles
    if (req.body.role && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can change user roles'
      });
    }

    // Update allowed fields
    const allowedFields = ['name', 'phone', 'preferences', 'emergencyContacts'];
    if (req.user.role === 'admin') {
      allowedFields.push('role', 'isActive', 'userType');
    }

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    await user.save();

    res.json({
      success: true,
      message: 'User updated successfully',
      data: { user }
    });

  } catch (error) {
    logger.error('Update user failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user. Please try again.'
    });
  }
});

// @desc    Delete user (Admin only)
// @route   DELETE /api/users/:id
// @access  Private (Admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent admin from deleting themselves
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    logger.error('Delete user failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user. Please try again.'
    });
  }
});

// @desc    Get users by coastal area
// @route   GET /api/users/area/:coastalArea
// @access  Private (Admin, Authority)
router.get('/area/:coastalArea', protect, authorize('admin', 'authority'), async (req, res) => {
  try {
    const { coastalArea } = req.params;
    const { userType, smsEnabled } = req.query;

    const filter = {
      'location.coastalArea': coastalArea,
      isActive: true
    };

    if (userType) filter.userType = userType;
    if (smsEnabled !== undefined) filter['preferences.smsEnabled'] = smsEnabled === 'true';

    const users = await User.find(filter)
      .select('name email phone userType preferences location createdAt')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: {
        coastalArea,
        userCount: users.length,
        users
      }
    });

  } catch (error) {
    logger.error('Get users by area failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users by area. Please try again.'
    });
  }
});

// @desc    Get user statistics
// @route   GET /api/users/stats
// @access  Private (Admin)
router.get('/stats', protect, authorize('admin'), async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } },
          verifiedUsers: { $sum: { $cond: ['$isVerified', 1, 0] } },
          userTypes: { $addToSet: '$userType' },
          roles: { $addToSet: '$role' },
          coastalAreas: { $addToSet: '$location.coastalArea' }
        }
      }
    ]);

    const userTypeStats = await User.aggregate([
      {
        $group: {
          _id: '$userType',
          count: { $sum: 1 }
        }
      }
    ]);

    const coastalAreaStats = await User.aggregate([
      {
        $group: {
          _id: '$location.coastalArea',
          count: { $sum: 1 }
        }
      }
    ]);

    const languageStats = await User.aggregate([
      {
        $group: {
          _id: '$preferences.language',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {},
        userTypeDistribution: userTypeStats,
        coastalAreaDistribution: coastalAreaStats,
        languageDistribution: languageStats
      }
    });

  } catch (error) {
    logger.error('Get user stats failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user statistics. Please try again.'
    });
  }
});

module.exports = router;
