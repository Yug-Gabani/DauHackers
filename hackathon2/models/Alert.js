const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Please add a description'],
    maxlength: [1000, 'Description cannot be more than 1000 characters']
  },
  type: {
    type: String,
    enum: ['storm', 'tide', 'pollution', 'erosion', 'emergency', 'weather', 'tsunami', 'cyclone'],
    required: [true, 'Please specify alert type']
  },
  severity: {
    type: String,
    enum: ['info', 'warning', 'critical', 'emergency'],
    required: [true, 'Please specify severity level'],
    default: 'warning'
  },
  status: {
    type: String,
    enum: ['active', 'resolved', 'expired', 'cancelled'],
    default: 'active'
  },
  location: {
    type: {
      type: String,
      enum: ['Point', 'Polygon'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude] for Point, [[[lng, lat], [lng, lat], ...]] for Polygon
      required: [true, 'Please provide coordinates']
    },
    coastalArea: {
      type: String,
      enum: ['mumbai', 'goa', 'kerala', 'tamilnadu', 'andhra', 'odisha', 'westbengal', 'gujarat'],
      required: [true, 'Please specify coastal area']
    },
    radius: {
      type: Number, // in kilometers
      default: 50
    },
    address: {
      city: String,
      state: String,
      country: String,
      postalCode: String
    }
  },
  affectedAreas: [{
    type: String,
    enum: ['mumbai', 'goa', 'kerala', 'tamilnadu', 'andhra', 'odisha', 'westbengal', 'gujarat']
  }],
  weatherData: {
    temperature: Number,
    humidity: Number,
    windSpeed: Number,
    windDirection: String,
    pressure: Number,
    visibility: Number,
    precipitation: Number
  },
  tideData: {
    currentLevel: Number,
    highTide: {
      time: Date,
      level: Number
    },
    lowTide: {
      time: Date,
      level: Number
    },
    nextChange: {
      time: Date,
      type: String // 'high' or 'low'
    }
  },
  waterQuality: {
    ph: Number,
    turbidity: Number,
    dissolvedOxygen: Number,
    temperature: Number,
    salinity: Number,
    contaminants: [String]
  },
  evacuationInfo: {
    required: {
      type: Boolean,
      default: false
    },
    routes: [{
      name: String,
      description: String,
      coordinates: [[Number]],
      distance: Number,
      estimatedTime: Number
    }],
    shelters: [{
      name: String,
      address: String,
      coordinates: [Number],
      capacity: Number,
      currentOccupancy: Number,
      contact: String
    }]
  },
  instructions: [{
    language: {
      type: String,
      enum: ['english', 'hindi', 'marathi', 'gujarati', 'tamil', 'telugu', 'malayalam', 'kannada']
    },
    text: String
  }],
  media: [{
    type: {
      type: String,
      enum: ['image', 'video', 'document']
    },
    url: String,
    caption: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }],
  source: {
    type: {
      type: String,
      enum: ['system', 'manual', 'api', 'community'],
      default: 'system'
    },
    name: String,
    reliability: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.8
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verificationNotes: String,
  expiresAt: Date,
  acknowledgedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    acknowledgedAt: Date,
    method: {
      type: String,
      enum: ['sms', 'email', 'push', 'web']
    }
  }],
  statistics: {
    totalRecipients: {
      type: Number,
      default: 0
    },
    deliveredCount: {
      type: Number,
      default: 0
    },
    readCount: {
      type: Number,
      default: 0
    },
    actionTakenCount: {
      type: Number,
      default: 0
    }
  },
  tags: [String],
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
AlertSchema.index({ 'location.coordinates': '2dsphere' });
AlertSchema.index({ type: 1, severity: 1 });
AlertSchema.index({ status: 1, createdAt: -1 });
AlertSchema.index({ 'location.coastalArea': 1, createdAt: -1 });
AlertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
AlertSchema.index({ createdBy: 1, createdAt: -1 });

// Virtual for alert age
AlertSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt;
});

// Virtual for isExpired
AlertSchema.virtual('isExpired').get(function() {
  if (!this.expiresAt) return false;
  return Date.now() > this.expiresAt;
});

// Virtual for urgency score
AlertSchema.virtual('urgencyScore').get(function() {
  let score = 0;
  
  // Severity weight
  const severityWeights = { info: 1, warning: 2, critical: 4, emergency: 8 };
  score += severityWeights[this.severity] || 1;
  
  // Type weight
  const typeWeights = { 
    emergency: 10, tsunami: 10, cyclone: 9, storm: 7, 
    tide: 5, pollution: 4, erosion: 3, weather: 2 
  };
  score += typeWeights[this.type] || 1;
  
  // Priority weight
  score += this.priority || 5;
  
  // Time decay (newer alerts get higher scores)
  const hoursSinceCreation = (Date.now() - this.createdAt) / (1000 * 60 * 60);
  score += Math.max(0, 10 - hoursSinceCreation);
  
  return Math.min(100, Math.max(0, score));
});

// Method to check if alert affects a specific location
AlertSchema.methods.affectsLocation = function(coordinates, radius = 0) {
  if (this.location.type === 'Point') {
    const distance = this.calculateDistance(coordinates, this.location.coordinates);
    return distance <= (this.location.radius + radius);
  }
  // For polygon, implement more complex intersection logic
  return true; // Simplified for now
});

// Method to calculate distance between two points
AlertSchema.methods.calculateDistance = function(coord1, coord2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
  const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Method to get alert in specific language
AlertSchema.methods.getInstruction = function(language = 'english') {
  const instruction = this.instructions.find(inst => inst.language === language);
  return instruction ? instruction.text : this.instructions[0]?.text || this.description;
};

// Static method to find active alerts for a location
AlertSchema.statics.findActiveAlertsForLocation = function(coordinates, radius = 50) {
  return this.find({
    status: 'active',
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates
        },
        $maxDistance: radius * 1000 // Convert to meters
      }
    },
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  }).sort({ priority: -1, createdAt: -1 });
};

module.exports = mongoose.model('Alert', AlertSchema);
