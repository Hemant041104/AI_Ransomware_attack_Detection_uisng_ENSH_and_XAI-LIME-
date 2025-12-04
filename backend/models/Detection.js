const mongoose = require('mongoose');

const detectionSchema = new mongoose.Schema({
  filename: { 
    type: String, 
    required: true 
  },
  fileSize: { 
    type: Number,  // In bytes
    required: true 
  },
  isRansomware: { 
    type: Boolean, 
    required: true 
  },
  entropyScore: { 
    type: Number,  // 0-8
    default: 0 
  },
  hash: { 
    type: String, 
    default: '' 
  },
  confidence: { 
    type: Number,  // 0-1
    default: 0 
  },
  explanation: { 
    type: Object,  // { features: [{name: '...', importance: ...}] }
    default: {} 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
});

// Index for sorting by timestamp
detectionSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Detection', detectionSchema);