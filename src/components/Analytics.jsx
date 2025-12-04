import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await axios.get('/api/analytics');
        setAnalytics(res.data);
      } catch (err) {
        console.error('Analytics fetch error:', err);
      }
      setLoading(false);
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return <div className="loading">Loading Analytics...</div>;
  }

  if (!analytics) {
    return (
      <div className="no-results">
        No data available. Upload files to see stats!
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link to="/" style={{ color: '#0d47a1', textDecoration: 'none', fontWeight: 'bold' }}>
            ← Back to Upload
          </Link>
        </div>
      </div>
    );
  }

  const COLORS = ['#44ff44', '#ff4444']; // Green for safe, red for ransomware

  return (
    <div className="analytics-section">
      <h2>Analytics Dashboard</h2>
      <p>Insights from your detections. Data updates after uploads.</p>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{analytics.totalDetections}</div>
          <p>Total Detections</p>
        </div>
        <div className="stat-card">
          <div className="stat-number">{analytics.ransomwarePercentage}%</div>
          <p>Ransomware Rate</p>
        </div>
        <div className="stat-card">
          <div className="stat-number">{analytics.averageEntropy}</div>
          <p>Avg Entropy Score</p>
        </div>
      </div>

      {/* Pie Chart: Safe vs Ransomware */}
      <div className="pie-chart">
        <h3>Detection Breakdown</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={analytics.pieData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {analytics.pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Line Chart: Timeline (Last 30 Days) */}
      {analytics.timeline && analytics.timeline.length > 0 ? (
        <div className="line-chart">
          <h3>Detections Over Time (Last 30 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.timeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" name="Total" stroke="#0d47a1" strokeWidth={2} />
              <Line type="monotone" dataKey="ransomware" name="Ransomware" stroke="#ff4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="no-results">No timeline data yet. Upload more files!</div>
      )}

      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <Link to="/" style={{ color: '#0d47a1', textDecoration: 'none', fontWeight: 'bold' }}>
          ← Back to Upload
        </Link>
      </div>
    </div>
  );
};

export default Analytics;