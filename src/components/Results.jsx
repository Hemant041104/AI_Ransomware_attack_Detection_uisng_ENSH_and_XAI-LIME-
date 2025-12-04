import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const Results = ({ detections }) => {
  if (!detections || detections.length === 0) {
    return <div className="no-results">No detections yet. Upload a file to get started!</div>;
  }

  return (
    <div className="results-section">
      <h2>Detection History (All Uploads)</h2>
      <p>Global results from the AI model. Each entry includes LIME-like explanations.</p>
      <div className="results-list">
        {detections.slice(0, 10).reverse().map((det) => (  // Show latest 10
          <div key={det._id} className={det.isRansomware ? 'alert' : 'success'}>
            <h3>{det.filename} - {det.isRansomware ? 'Ransomware Detected' : 'Safe'}</h3>
            <p><strong>Date:</strong> {new Date(det.timestamp).toLocaleString()}</p>
            <p><strong>Entropy Score:</strong> {det.entropyScore?.toFixed(2)}</p>
            <p><strong>Neural Hash:</strong> {det.hash?.substring(0, 30)}...</p>
            {det.confidence !== undefined && <p><strong>Confidence:</strong> {(det.confidence * 100).toFixed(1)}%</p>}
            <p><strong>File Size:</strong> {((det.fileSize || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB</p>
            
            {/* LIME-like Explanation Chart */}
            {det.explanation && det.explanation.features && det.explanation.features.length > 0 && (
              <div className="chart">
                <h4>Explainable AI (LIME): Feature Importance</h4>
                <p>Why was this classified? (Local Interpretable Model-agnostic Explanations from your model)</p>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={det.explanation.features}>
                    <XAxis dataKey="name" tick={{ fill: '#fff' }} />
                    <YAxis tick={{ fill: '#fff' }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#333', border: 'none', color: '#fff' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar 
                      dataKey="importance" 
                      fill={det.isRansomware ? '#ff4444' : '#44ff44'} 
                      name="Importance (%)"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {!det.explanation && (
              <p style={{ color: '#ccc', fontStyle: 'italic' }}>No explanation available from model.</p>
            )}
          </div>
        ))}
      </div>
      {detections.length > 10 && (
        <p style={{ textAlign: 'center', color: '#ccc' }}>Showing latest 10 results. Upload more to see updates.</p>
      )}
    </div>
  );
};

export default Results;