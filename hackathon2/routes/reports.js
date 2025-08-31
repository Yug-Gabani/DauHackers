const express = require('express');
const { body, query, validationResult } = require('express-validator');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const { protect, optionalAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
    files: 3
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|avi|mov/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Mock Report model (in production, you'd create a proper model)
class Report {
  constructor(data) {
    this.id = Date.now().toString();
    this.type = data.type;
    this.description = data.description;
    this.location = data.location;
    this.coordinates = data.coordinates;
    this.coastalArea = data.coastalArea;
    this.reportedBy = data.reportedBy;
    this.status = 'pending';
    this.priority = data.priority || 'medium';
    this.media = data.media || [];
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }
}

// In-memory storage for reports (replace with database in production)
let reports = [];

// @desc    Submit a community report
// @route   POST /api/reports
// @access  Public (with optional authentication)
router.post('/', upload.array('media', 3), [
  body('type').isIn(['pollution', 'erosion', 'illegal', 'weather', 'other']).withMessage('Valid report type is required'),
  body('description').isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
  body('location').notEmpty().withMessage('Location description is required'),
  body('coordinates').isArray({ min: 2, max: 2 }).withMessage('Coordinates must be an array of 2 numbers'),
  body('coastalArea').isIn(['mumbai', 'goa', 'kerala', 'tamilnadu', 'andhra', 'odisha', 'westbengal', 'gujarat']).withMessage('Valid coastal area is required'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority level')
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
      type,
      description,
      location,
      coordinates,
      coastalArea,
      priority = 'medium'
    } = req.body;

    // Handle file uploads
    const mediaFiles = [];
    if (req.files && req.files.length > 0) {
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
            type: file.mimetype.startsWith('image/') ? 'image' : 'video',
            url: `/uploads/${fileName}`,
            caption: file.originalname
          });
        } catch (fileError) {
          logger.error('File processing failed:', fileError);
        }
      }
    }

    const reportData = {
      type,
      description,
      location,
      coordinates,
      coastalArea,
      priority,
      media: mediaFiles,
      reportedBy: req.user ? req.user.id : 'anonymous'
    };

    const report = new Report(reportData);
    reports.push(report);

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      data: { report }
    });

  } catch (error) {
    logger.error('Submit report failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit report. Please try again.'
    });
  }
});

// @desc    Get all reports with filtering
// @route   GET /api/reports
// @access  Public
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('type').optional().isIn(['pollution', 'erosion', 'illegal', 'weather', 'other']).withMessage('Invalid report type'),
  query('status').optional().isIn(['pending', 'investigating', 'resolved', 'closed']).withMessage('Invalid status'),
  query('coastalArea').optional().isIn(['mumbai', 'goa', 'kerala', 'tamilnadu', 'andhra', 'odisha', 'westbengal', 'gujarat']).withMessage('Invalid coastal area'),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority level')
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
      type,
      status,
      coastalArea,
      priority
    } = req.query;

    // Build filter
    let filteredReports = [...reports];
    
    if (type) {
      filteredReports = filteredReports.filter(report => report.type === type);
    }
    if (status) {
      filteredReports = filteredReports.filter(report => report.status === status);
    }
    if (coastalArea) {
      filteredReports = filteredReports.filter(report => report.coastalArea === coastalArea);
    }
    if (priority) {
      filteredReports = filteredReports.filter(report => report.priority === priority);
    }

    // Sort by creation date (newest first)
    filteredReports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const skip = (page - 1) * limit;
    const paginatedReports = filteredReports.slice(skip, skip + parseInt(limit));
    const total = filteredReports.length;
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        reports: paginatedReports,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get reports failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve reports. Please try again.'
    });
  }
});

// @desc    Get report by ID
// @route   GET /api/reports/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const report = reports.find(r => r.id === req.params.id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    res.json({
      success: true,
      data: { report }
    });

  } catch (error) {
    logger.error('Get report by ID failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve report. Please try again.'
    });
  }
});

// @desc    Update report status (Admin/Authority only)
// @route   PUT /api/reports/:id/status
// @access  Private (Admin, Authority)
router.put('/:id/status', protect, [
  body('status').isIn(['pending', 'investigating', 'resolved', 'closed']).withMessage('Valid status is required'),
  body('notes').optional().isLength({ max: 500 }).withMessage('Notes must be less than 500 characters')
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

    const { status, notes } = req.body;
    const report = reports.find(r => r.id === req.params.id);
    
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    report.status = status;
    report.notes = notes;
    report.updatedAt = new Date();
    report.updatedBy = req.user.id;

    res.json({
      success: true,
      message: 'Report status updated successfully',
      data: { report }
    });

  } catch (error) {
    logger.error('Update report status failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update report status. Please try again.'
    });
  }
});

// @desc    Get reports by coastal area
// @route   GET /api/reports/area/:coastalArea
// @access  Public
router.get('/area/:coastalArea', async (req, res) => {
  try {
    const { coastalArea } = req.params;
    const { type, status, priority } = req.query;

    let filteredReports = reports.filter(report => report.coastalArea === coastalArea);
    
    if (type) {
      filteredReports = filteredReports.filter(report => report.type === type);
    }
    if (status) {
      filteredReports = filteredReports.filter(report => report.status === status);
    }
    if (priority) {
      filteredReports = filteredReports.filter(report => report.priority === priority);
    }

    // Sort by priority and creation date
    filteredReports.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json({
      success: true,
      data: {
        coastalArea,
        reportCount: filteredReports.length,
        reports: filteredReports.slice(0, 50) // Limit to 50 most recent
      }
    });

  } catch (error) {
    logger.error('Get reports by area failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve reports by area. Please try again.'
    });
  }
});

// @desc    Get report statistics
// @route   GET /api/reports/stats
// @access  Public
router.get('/stats', async (req, res) => {
  try {
    const stats = {
      totalReports: reports.length,
      byType: {},
      byStatus: {},
      byPriority: {},
      byCoastalArea: {},
      recentReports: reports.filter(r => {
        const daysAgo = (Date.now() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        return daysAgo <= 7;
      }).length
    };

    // Count by type
    reports.forEach(report => {
      stats.byType[report.type] = (stats.byType[report.type] || 0) + 1;
      stats.byStatus[report.status] = (stats.byStatus[report.status] || 0) + 1;
      stats.byPriority[report.priority] = (stats.byPriority[report.priority] || 0) + 1;
      stats.byCoastalArea[report.coastalArea] = (stats.byCoastalArea[report.coastalArea] || 0) + 1;
    });

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Get report stats failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve report statistics. Please try again.'
    });
  }
});

module.exports = router;
