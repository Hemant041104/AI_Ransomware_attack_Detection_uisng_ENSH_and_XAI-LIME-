const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');  // Assumes model exists

// POST /api/feedback - Submit feedback linked to a detection
router.post('/', async (req, res) => {
  try {
    const { detectionId, predictionFeedback, review } = req.body;
    if (!detectionId || predictionFeedback?.accurate === undefined || !review?.stars) {
      return res.status(400).json({ msg: 'Missing required fields: detectionId, predictionFeedback, or review.stars' });
    }
    const feedback = new Feedback({
      detectionId,
      predictionFeedback,
      review
    });
    await feedback.save();
    console.log(`✅ Feedback saved for detection ${detectionId}`);
    res.json({ msg: 'Feedback saved successfully' });
  } catch (err) {
    console.error('Feedback save error:', err);
    res.status(500).json({ msg: 'Server error saving feedback' });
  }
});

module.exports = router;  // This exports the Router instance—CRITICAL!