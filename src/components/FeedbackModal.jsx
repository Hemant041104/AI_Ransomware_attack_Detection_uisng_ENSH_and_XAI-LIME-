import React, { useState } from 'react';
import axios from 'axios';

const FeedbackModal = ({ detectionId, onClose }) => {
  const [predictionFeedback, setPredictionFeedback] = useState('');  // 'accurate' or 'inaccurate'
  const [predictionComment, setPredictionComment] = useState('');
  const [reviewStars, setReviewStars] = useState(0);  // 1-5
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleStarClick = (star) => {
    setReviewStars(star);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!predictionFeedback || reviewStars === 0) {
      return alert('Please provide at least prediction feedback and a star rating.');
    }

    setSubmitting(true);
    try {
      await axios.post('/api/feedback', {
        detectionId,
        predictionFeedback: {
          accurate: predictionFeedback === 'accurate',
          comment: predictionComment.trim()
        },
        review: {
          stars: reviewStars,
          comment: reviewComment.trim()
        }
      });
      alert('Thank you for your feedback! It helps improve the system.');
      onClose();  // Close modal
    } catch (err) {
      console.error('Feedback submit error:', err);
      alert('Feedback submission failed. You can try again later.');
    }
    setSubmitting(false);
  };

  const handleClose = (e) => {
    if (e) e.preventDefault();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Provide Your Feedback</h3>
          <p>Help us improve predictions and the website!</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Prediction Feedback Section */}
          <section className="feedback-section">
            <h4>1. Prediction Feedback</h4>
            <p>Was the ransomware prediction accurate?</p>
            <div className="radio-group">
              <label className="radio-option">
                <input
                  type="radio"
                  name="prediction"
                  value="accurate"
                  checked={predictionFeedback === 'accurate'}
                  onChange={(e) => setPredictionFeedback(e.target.value)}
                  required
                />
                👍 Accurate
              </label>
              <label className="radio-option">
                <input
                  type="radio"
                  name="prediction"
                  value="inaccurate"
                  checked={predictionFeedback === 'inaccurate'}
                  onChange={(e) => setPredictionFeedback(e.target.value)}
                />
                👎 Inaccurate
              </label>
            </div>
            <textarea
              className="feedback-textarea"
              placeholder="Optional: Add details (e.g., 'False positive - file was safe')"
              value={predictionComment}
              onChange={(e) => setPredictionComment(e.target.value)}
              rows={3}
            />
          </section>

          {/* Website Review Section */}
          <section className="feedback-section">
            <h4>2. Website Review</h4>
            <p>Rate the overall experience (1-5 stars):</p>
            <div className="stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`star ${reviewStars >= star ? 'selected' : ''}`}
                  onClick={() => handleStarClick(star)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleStarClick(star)}
                >
                  ★
                </span>
              ))}
            </div>
            <textarea
              className="feedback-textarea"
              placeholder="Optional: What did you like or suggest? (e.g., 'UI is great, but add more charts')"
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              rows={3}
            />
          </section>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button type="submit" disabled={submitting || !predictionFeedback || reviewStars === 0}>
              {submitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              style={{
                marginLeft: '10px',
                background: 'linear-gradient(45deg, #666, #999)',
                color: '#fff'
              }}
              disabled={submitting}
            >
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FeedbackModal;