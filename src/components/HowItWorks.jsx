import React from 'react';
import { Link } from 'react-router-dom';

const HowItWorks = () => {
  return (
    <div className="upload-section" style={{ textAlign: 'left' }}>
      <h2>How It Works: AI Powered Ransomguard Detection</h2>
      <p>This tool uses advanced AI to detect ransomware in .exe and .msi files by analyzing entropy, neural hashing, and providing explainable insights.</p>
      
      <section className="feedback-section">
        <h3>1. File Upload & Preprocessing</h3>
        <ul>
          <li>Upload .exe or .msi files (up to 10GB).</li>
          <li>Server validates and temporarily stores the file securely.</li>
          <li>Computes basic stats like size and extension.</li>
        </ul>
      </section>

      <section className="feedback-section">
        <h3>2. AI Model Analysis (Entropy Synchronized Neural Hashing)</h3>
        <ul>
          <li><strong>Entropy Calculation</strong>: Measures file randomness (0-8 scale). Ransomware often has high entropy due to encryption (e.g., {'>'}7 indicates suspicious).</li>
          <li><strong>Neural Hashing</strong>: Generates a unique hash using a trained neural network to detect malicious patterns (beyond simple SHA256).</li>
          <li><strong>Prediction</strong>: A machine learning model (e.g., trained on ransomware datasets) classifies as "Safe" or "Ransomware" with confidence score (0-100%).</li>
        </ul>
      </section>

      <section className="feedback-section">
        <h3>3. Explainable AI (LIME Explanations)</h3>
        <ul>
          <li>Uses LIME (Local Interpretable Model-agnostic Explanations) to show why the prediction was made.</li>
          <li>Features like "Entropy Score" or "Hash Mismatch" ranked by importance (bar chart in results).</li>
          <li>Helps users understand: e.g., "High entropy contributed 75% to ransomware detection."</li>
        </ul>
      </section>

      <section className="feedback-section">
        <h3>4. Storage & Cleanup</h3>
        <ul>
          <li>Results saved anonymously in MongoDB for history/analytics.</li>
          <li>File deleted immediately after processing (no permanent storage).</li>
          <li>View global stats in Analytics or provide feedback post-upload.</li>
        </ul>
      </section>

      <p style={{ textAlign: 'center' }}>
        <Link to="/" style={{ color: '#0d47a1' }}>← Back to Upload</Link>
      </p>
    </div>
  );
};

export default HowItWorks;