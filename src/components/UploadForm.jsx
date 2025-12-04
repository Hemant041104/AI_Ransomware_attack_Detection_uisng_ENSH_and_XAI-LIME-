import React, { useState } from 'react';
import axios from 'axios';
import FeedbackModal from './FeedbackModal';

const UploadForm = ({ onDetect }) => {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [abortController, setAbortController] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fileExt = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!file || !['.exe', '.msi'].includes(fileExt)) {
      return alert('Please select a .exe or .msi file only (up to 10GB)');
    }
    if (file.size > 10 * 1024 * 1024 * 1024) {  // 10GB
      return alert('File size exceeds 10GB limit.');
    }

    setLoading(true);
    setProgress(0);
    const formData = new FormData();
    formData.append('file', file);

    const controller = new AbortController();  // For cancel functionality
    setAbortController(controller);

    try {
      const res = await axios.post('/api/detection/upload', formData, {
        signal: controller.signal,
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total && !controller.signal.aborted) {
            setProgress((progressEvent.loaded / progressEvent.total) * 100);
          }
        },
        timeout: 0  // No timeout for large files/Python processing
      });
      setResult(res.data);
      onDetect();  // Refresh results
      console.log('API Response:', res.data);
      setShowFeedback(true);  // Trigger feedback modal
      alert(res.data.isRansomware ? '🚨 Ransomware Detected! Proceed with caution.' : '✅ File is Safe.');
    } catch (err) {
      if (err.name === 'AbortError') {
        alert('Upload cancelled by user.');
      } else {
        console.error(err);
        alert('Upload or prediction failed: ' + (err.response?.data?.msg || err.message || 'Unknown error. Check console.'));
      }
    }
    setLoading(false);
    setProgress(0);
    setAbortController(null);
  };

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
    }
    setLoading(false);
    setProgress(0);
    setAbortController(null);
  };

  const handleFeedbackClose = () => {
    setShowFeedback(false);
  };

  return (
    <div className="upload-section">
      <h2>Upload .exe or .msi File for AI Prediction</h2>
      <p>Files up to 10GB. Your trained model (app.py) will perform Entropy Synchronized Neural Hashing with LIME explanations.</p>
      <form onSubmit={handleSubmit}>
        <input 
          type="file" 
          accept=".exe,.msi" 
          onChange={(e) => setFile(e.target.files[0])} 
          required 
          disabled={loading}
        />
        <p style={{ fontSize: '0.9em', color: '#ccc' }}>Max size: 10GB. Processing may take time for large files.</p>
        <button type="submit" disabled={loading || !file}>
          {loading ? 'Uploading & Running Model...' : 'Start Detection'}
        </button>
        {loading && (
          <button 
            type="button" 
            onClick={handleCancel} 
            style={{ 
              marginLeft: '10px', 
              background: 'linear-gradient(45deg, #ff4444, #cc0000)',
              color: '#fff'
            }}
          >
            Cancel Upload
          </button>
        )}
      </form>
      {loading && (
        <div>
          <p>Upload Progress: {progress.toFixed(1)}%</p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <p>Model Prediction in Progress...</p>
        </div>
      )}
      {result && (
        <div className={result.isRansomware ? 'alert' : 'success'}>
          <h3>Result for {result.filename}</h3>
          <p><strong>Status:</strong> {result.isRansomware ? '🚨 RANSOMWARE DETECTED' : '✅ SAFE'}</p>
          <p><strong>Entropy Score:</strong> {result.entropyScore?.toFixed(2)} (0-8, higher indicates encryption)</p>
          <p><strong>Neural Hash:</strong> {result.hash?.substring(0, 20)}...</p>
          {result.confidence !== undefined && <p><strong>Confidence:</strong> {(result.confidence * 100).toFixed(1)}%</p>}
          <p><strong>File Size:</strong> {((result.fileSize || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB</p>
              {/* Show LIME image if available from backend */}
              {result.explanation?.lime_image && (
                <div style={{ marginTop: '12px' }}>
                  <h4>Why this prediction?</h4>
                  <img src={result.explanation.lime_image} alt="LIME Explanation" style={{ maxWidth: '100%', borderRadius: 8, border: '2px solid #00c6ff' }} />
                </div>
              )}
              {/* List top features if available */}
              {result.explanation?.features && Array.isArray(result.explanation.features) && (
                <div style={{ marginTop: '10px', textAlign: 'left' }}>
                  <h4>Top Features</h4>
                  <ul>
                    {result.explanation.features.slice(0, 6).map((f, idx) => (
                      <li key={idx}>
                        <strong>{f.feature || f.name || f[0] || 'feature'}</strong>: {((f.impact ?? f.importance ?? f[1])?.toString())}
                        {f.meaning ? ` — ${f.meaning}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
        </div>
      )}
      {showFeedback && (
        <FeedbackModal 
          detectionId={result?._id} 
          onClose={handleFeedbackClose} 
        />
      )}
    </div>
  );
};

export default UploadForm;