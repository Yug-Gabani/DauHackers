const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  phone: {
    type: String,
    required: [true, 'Please add a phone number'],
    match: [/^\+?[\d\s-()]+$/, 'Please add a valid phone number']
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'fisherfolk', 'business', 'authority', 'admin'],
    default: 'user'
  },
  userType: {
    type: String,
    enum: ['fisherfolk', 'business', 'tourist', 'ngo', 'authority', 'general'],
    required: [true, 'Please select user type']
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      required: [true, 'Please provide coordinates']
    },
    address: {
      city: String,
      state: String,
      country: String,
      postalCode: String
    },
    coastalArea: {
      type: String,
      enum: ['mumbai', 'goa', 'kerala', 'tamilnadu', 'andhra', 'odisha', 'westbengal', 'gujarat'],
      required: [true, 'Please select coastal area']
    }
  },
  preferences: {
    language: {
      type: String,
      enum: ['english', 'hindi', 'marathi', 'gujarati', 'tamil', 'telugu', 'malayalam', 'kannada'],
      default: 'english'
    },
    alertTypes: [{
      type: String,
      enum: ['storm', 'tide', 'pollution', 'erosion', 'emergency', 'weather']
    }],
    smsEnabled: {
      type: Boolean,
      default: true
    },
    emailEnabled: {
      type: Boolean,
      default: true
    },
    pushEnabled: {
      type: Boolean,
      default: false
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  lastLogin: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  profileImage: {
    type: String,
    default: null
  },
  emergencyContacts: [{
    name: String,
    phone: String,
    relationship: String
  }],
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'premium'],
      default: 'free'
    },
    startDate: Date,
    endDate: Date,
    features: [String]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for geospatial queries
UserSchema.index({ 'location.coordinates': '2dsphere' });

// Index for common queries
UserSchema.index({ email: 1 });
UserSchema.index({ phone: 1 });
UserSchema.index({ 'location.coastalArea': 1 });
UserSchema.index({ role: 1 });

// Virtual for full address
UserSchema.virtual('fullAddress').get(function() {
  if (this.location.address) {
    const { city, state, country, postalCode } = this.location.address;
    return [city, state, country, postalCode].filter(Boolean).join(', ');
  }
  return '';
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate verification token
UserSchema.methods.generateVerificationToken = function() {
  const verificationToken = crypto.randomBytes(20).toString('hex');
  this.verificationToken = verificationToken;
  this.verificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return verificationToken;
};

// Generate password reset token
UserSchema.methods.generatePasswordResetToken = function() {
  const resetToken = crypto.randomBytes(20).toString('hex');
  this.resetPasswordToken = resetToken;
  this.resetPasswordExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return resetToken;
};

// Check if user is in specific coastal area
UserSchema.methods.isInCoastalArea = function(area) {
  return this.location.coastalArea === area;
};

// Get user's alert preferences
UserSchema.methods.getAlertPreferences = function() {
  return {
    language: this.preferences.language,
    alertTypes: this.preferences.alertTypes,
    smsEnabled: this.preferences.smsEnabled,
    emailEnabled: this.preferences.emailEnabled,
    pushEnabled: this.preferences.pushEnabled
  };
};

module.exports = mongoose.model('User', UserSchema);
