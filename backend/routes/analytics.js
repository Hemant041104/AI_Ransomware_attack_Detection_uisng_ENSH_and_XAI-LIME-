const express = require('express');
const router = express.Router();
const Detection = require('../models/Detection');

// GET /api/analytics - Fetch detection statistics
router.get('/', async (req, res) => {
  try {
    const totalDetections = await Detection.countDocuments();
    const ransomwareCount = await Detection.countDocuments({ isRansomware: true });
    const safeCount = totalDetections - ransomwareCount;
    const ransomwarePercentage = totalDetections > 0 ? ((ransomwareCount / totalDetections) * 100).toFixed(1) : 0;

    // Average entropy (only for detections with entropyScore)
    const avgEntropy = await Detection.aggregate([
      { $match: { entropyScore: { $exists: true } } },
      { $group: { _id: null, avg: { $avg: '$entropyScore' } } }
    ]);
    const averageEntropy = avgEntropy[0]?.avg?.toFixed(2) || 0;

    // Timeline: Detections per day (last 30 days, for line chart)
    const timeline = await Detection.aggregate([
      { 
        $match: { 
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }  // Last 30 days
        } 
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          ransomware: { $sum: { $cond: [{ $eq: ['$isRansomware', true] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 30 }
    ]);

    // Pie chart data: Safe vs Ransomware
    const pieData = [
      { name: 'Safe', value: safeCount, fill: '#44ff44' },
      { name: 'Ransomware', value: ransomwareCount, fill: '#ff4444' }
    ];

    res.json({
      totalDetections,
      ransomwareCount,
      safeCount,
      ransomwarePercentage,
      averageEntropy,
      timeline: timeline.map(day => ({ date: day._id, count: day.count, ransomware: day.ransomware })),
      pieData
    });
  } catch (err) {
    console.error('Analytics fetch error:', err);
    res.status(500).json({ msg: 'Server error fetching analytics' });
  }
});

module.exports = router;