import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import HowItWorks from './components/HowItWorks';
import Analytics from './components/Analytics';
import './App.css';

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/results" element={<Dashboard />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="*" element={<Dashboard />} />  {/* Fallback to Dashboard for unknown routes */}
      </Routes>
    </div>
  );
}

export default App;