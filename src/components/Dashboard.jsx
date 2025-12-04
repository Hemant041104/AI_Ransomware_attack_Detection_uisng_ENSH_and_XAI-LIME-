import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import UploadForm from './UploadForm';
import Results from './Results';

const Dashboard = () => {
  const [detections, setDetections] = useState([]);
  const [activeTab, setActiveTab] = useState('upload');
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  const fetchDetections = async () => {
    try {
      const res = await axios.get('/api/detection');
      setDetections(res.data);
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  useEffect(() => {
    fetchDetections();
    setLoading(false);
    // Set tab based on route
    if (location.pathname === '/results') {
      setActiveTab('results');
    }
  }, [location.pathname]);

  return (
    <>
      <header>
        <h1>AI Powered Ransomguard Detection</h1>
        <nav>
          <Link to="/" onClick={() => setActiveTab('upload')}>Upload File</Link> | 
          <Link to="/results" onClick={() => setActiveTab('results')}>View Results</Link> | 
          <Link to="/how-it-works">How It Works</Link> | 
          <Link to="/analytics">Analytics</Link>
        </nav>
      </header>
      <main>
        {loading ? (
          <div className="loading">Loading Dashboard...</div>
        ) : activeTab === 'upload' ? (
          <UploadForm onDetect={fetchDetections} />
        ) : (
          <Results detections={detections} />
        )}
      </main>
    </>
  );
};

export default Dashboard;