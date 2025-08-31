const express = require('express');
const { body, validationResult, query } = require('express-validator');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const Alert = require('../models/Alert');
const User = require('../models/User');
const { protect, authorize, checkOwnership } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|avi|mov|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image, video, and document files are allowed'));
    }
  }
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// @desc    Create new alert
// @route   POST /api/alerts
// @access  Private
router.post('/', protect, upload.array('media', 5), [
  body('title').trim().isLength({ min: 5, max: 100 }).withMessage('Title must be between 5 and 100 characters'),
  body('description').isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
  body('type').isIn(['storm', 'tide', 'pollution', 'erosion', 'emergency', 'weather', 'tsunami', 'cyclone']).withMessage('Invalid alert type'),
  body('severity').isIn(['info', 'warning', 'critical', 'emergency']).withMessage('Invalid severity level'),
  body('location.coordinates').isArray({ min: 2, max: 2 }).withMessage('Coordinates must be an array of 2 numbers'),
  body('location.coastalArea').isIn(['mumbai', 'goa', 'kerala', 'tamilnadu', 'andhra', 'odisha', 'westbengal', 'gujarat']).withMessage('Invalid coastal area'),
  body('priority').optional().isInt({ min: 1, max: 10 }).withMessage('Priority must be between 1 and 10')
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

    const alertData = {
      ...req.body,
      createdBy: req.user.id,
      verificationStatus: req.user.role === 'admin' || req.user.role === 'authority' ? 'verified' : 'pending'
    };

    // Handle file uploads
    if (req.files && req.files.length > 0) {
      const mediaFiles = [];
      
      for (const file of req.files) {
        try {
          let processedFile;
          const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
          const filePath = path.join(uploadsDir, fileName);
          
          if (file.mimetype.startsWith('image/')) {
            // Process images with sharp
            processedFile = await sharp(file.buffer)
              .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 80 })
              .toFile(filePath);
          } else {
            // Save other files as-is
            fs.writeFileSync(filePath, file.buffer);
          }
          
          mediaFiles.push({
            type: file.mimetype.startsWith('image/') ? 'image' : 
                   file.mimetype.startsWith('video/') ? 'video' : 'document',
            url: `/uploads/${fileName}`,
            caption: file.originalname,
            uploadedBy: req.user.id
          });
        } catch (fileError) {
          logger.error('File processing failed:', fileError);
        }
      }
      
      if (mediaFiles.length > 0) {
        alertData.media = mediaFiles;
      }
    }

    const alert = await Alert.create(alertData);

    // Populate creator information
    await alert.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Alert created successfully',
      data: { alert }
    });

  } catch (error) {
    logger.error('Alert creation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create alert. Please try again.'
    });
  }
});

// @desc    Get all alerts with filtering and pagination
// @route   GET /api/alerts
// @access  Public
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('type').optional().isIn(['storm', 'tide', 'pollution', 'erosion', 'emergency', 'weather', 'tsunami', 'cyclone']).withMessage('Invalid alert type'),
  query('severity').optional().isIn(['info', 'warning', 'critical', 'emergency']).withMessage('Invalid severity level'),
  query('status').optional().isIn(['active', 'resolved', 'expired', 'cancelled']).withMessage('Invalid status'),
  query('coastalArea').optional().isIn(['mumbai', 'goa', 'kerala', 'tamilnadu', 'andhra', 'odisha', 'westbengal', 'gujarat']).withMessage('Invalid coastal area'),
  query('sortBy').optional().isIn(['createdAt', 'priority', 'severity', 'urgencyScore']).withMessage('Invalid sort field'),
  query('sortOrder').optional().isIn(['asc', 'desc']).withMessage('Sort order must be asc or desc')
], async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      severity,
      status = 'active',
      coastalArea,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      coordinates,
      radius = 50
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (type) filter.type = type;
    if (severity) filter.severity = severity;
    if (status) filter.status = status;
    if (coastalArea) filter['location.coastalArea'] = coastalArea;
    
    // Add expiration filter for active alerts
    if (status === 'active') {
      filter.$or = [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ];
    }

    // Geospatial query if coordinates provided
    if (coordinates) {
      try {
        const [lng, lat] = coordinates.split(',').map(Number);
        if (!isNaN(lng) && !isNaN(lat)) {
          filter['location.coordinates'] = {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [lng, lat]
              },
              $maxDistance: radius * 1000 // Convert to meters
            }
          };
        }
      } catch (coordError) {
        logger.warn('Invalid coordinates provided:', coordinates);
      }
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const skip = (page - 1) * limit;
    
    const [alerts, total] = await Promise.all([
      Alert.find(filter)
        .populate('createdBy', 'name email')
        .populate('verifiedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Alert.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      success: true,
      data: {
        alerts,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit),
          hasNextPage,
          hasPrevPage
        }
      }
    });

  } catch (error) {
    logger.error('Get alerts failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve alerts. Please try again.'
    });
  }
});

// @desc    Get alert by ID
// @route   GET /api/alerts/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate('createdBy', 'name email userType')
      .populate('verifiedBy', 'name email')
      .populate('acknowledgedBy.user', 'name email');

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    res.json({
      success: true,
      data: { alert }
    });

  } catch (error) {
    logger.error('Get alert by ID failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve alert. Please try again.'
    });
  }
});

// @desc    Update alert
// @route   PUT /api/alerts/:id
// @access  Private (Creator, Admin, Authority)
router.put('/:id', protect, upload.array('media', 5), [
  body('title').optional().trim().isLength({ min: 5, max: 100 }).withMessage('Title must be between 5 and 100 characters'),
  body('description').optional().isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
  body('type').optional().isIn(['storm', 'tide', 'pollution', 'erosion', 'emergency', 'weather', 'tsunami', 'cyclone']).withMessage('Invalid alert type'),
  body('severity').optional().isIn(['info', 'warning', 'critical', 'emergency']).withMessage('Invalid severity level'),
  body('status').optional().isIn(['active', 'resolved', 'expired', 'cancelled']).withMessage('Invalid status')
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

    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && req.user.role !== 'authority' && 
        alert.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this alert'
      });
    }

    // Update alert fields
    const allowedFields = ['title', 'description', 'type', 'severity', 'status', 'priority', 'expiresAt', 'instructions'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        alert[field] = req.body[field];
      }
    });

    // Handle media updates
    if (req.files && req.files.length > 0) {
      const mediaFiles = [];
      
      for (const file of req.files) {
        try {
          const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
          const filePath = path.join(uploadsDir, fileName);
          
          if (file.mimetype.startsWith('image/')) {
            await sharp(file.buffer)
              .resize(800, 600, { fit: 'inside', withoutEnlargement: true })
              .jpeg({ quality: 80 })
              .toFile(filePath);
          } else {
            fs.writeFileSync(filePath, file.buffer);
          }
          
          mediaFiles.push({
            type: file.mimetype.startsWith('image/') ? 'image' : 
                   file.mimetype.startsWith('video/') ? 'video' : 'document',
            url: `/uploads/${fileName}`,
            caption: file.originalname,
            uploadedBy: req.user.id
          });
        } catch (fileError) {
          logger.error('File processing failed:', fileError);
        }
      }
      
      if (mediaFiles.length > 0) {
        alert.media = [...(alert.media || []), ...mediaFiles];
      }
    }

    await alert.save();

    // Populate updated alert
    await alert.populate('createdBy', 'name email');

    res.json({
      success: true,
      message: 'Alert updated successfully',
      data: { alert }
    });

  } catch (error) {
    logger.error('Alert update failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update alert. Please try again.'
    });
  }
});

// @desc    Delete alert
// @route   DELETE /api/alerts/:id
// @access  Private (Creator, Admin, Authority)
router.delete('/:id', protect, async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Check permissions
    if (req.user.role !== 'admin' && req.user.role !== 'authority' && 
        alert.createdBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this alert'
      });
    }

    await Alert.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Alert deleted successfully'
    });

  } catch (error) {
    logger.error('Alert deletion failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete alert. Please try again.'
    });
  }
});

// @desc    Verify alert
// @route   POST /api/alerts/:id/verify
// @access  Private (Admin, Authority)
router.post('/:id/verify', protect, authorize('admin', 'authority'), [
  body('verificationStatus').isIn(['verified', 'rejected']).withMessage('Invalid verification status'),
  body('verificationNotes').optional().isLength({ max: 500 }).withMessage('Verification notes must be less than 500 characters')
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

    const { verificationStatus, verificationNotes } = req.body;

    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    alert.verificationStatus = verificationStatus;
    alert.verificationNotes = verificationNotes;
    alert.verifiedBy = req.user.id;
    
    if (verificationStatus === 'verified') {
      alert.status = 'active';
    }

    await alert.save();

    res.json({
      success: true,
      message: `Alert ${verificationStatus} successfully`,
      data: { alert }
    });

  } catch (error) {
    logger.error('Alert verification failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify alert. Please try again.'
    });
  }
});

// @desc    Acknowledge alert
// @route   POST /api/alerts/:id/acknowledge
// @access  Private
router.post('/:id/acknowledge', protect, [
  body('method').isIn(['sms', 'email', 'push', 'web']).withMessage('Invalid acknowledgment method')
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

    const { method } = req.body;

    const alert = await Alert.findById(req.params.id);
    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert not found'
      });
    }

    // Check if user already acknowledged
    const alreadyAcknowledged = alert.acknowledgedBy.some(
      ack => ack.user.toString() === req.user.id
    );

    if (alreadyAcknowledged) {
      return res.status(400).json({
        success: false,
        message: 'Alert already acknowledged'
      });
    }

    // Add acknowledgment
    alert.acknowledgedBy.push({
      user: req.user.id,
      acknowledgedAt: new Date(),
      method
    });

    await alert.save();

    res.json({
      success: true,
      message: 'Alert acknowledged successfully'
    });

  } catch (error) {
    logger.error('Alert acknowledgment failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to acknowledge alert. Please try again.'
    });
  }
});

// @desc    Get alerts for specific location
// @route   GET /api/alerts/location/:coastalArea
// @access  Public
router.get('/location/:coastalArea', async (req, res) => {
  try {
    const { coastalArea } = req.params;
    const { coordinates, radius = 50 } = req.query;

    let filter = {
      'location.coastalArea': coastalArea,
      status: 'active',
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gt: new Date() } }
      ]
    };

    // Add geospatial filter if coordinates provided
    if (coordinates) {
      try {
        const [lng, lat] = coordinates.split(',').map(Number);
        if (!isNaN(lng) && !isNaN(lat)) {
          filter['location.coordinates'] = {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [lng, lat]
              },
              $maxDistance: radius * 1000
            }
          };
        }
      } catch (coordError) {
        logger.warn('Invalid coordinates provided:', coordinates);
      }
    }

    const alerts = await Alert.find(filter)
      .populate('createdBy', 'name email')
      .sort({ priority: -1, createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: { alerts }
    });

  } catch (error) {
    logger.error('Get alerts by location failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve alerts for location. Please try again.'
    });
  }
});

module.exports = router;
