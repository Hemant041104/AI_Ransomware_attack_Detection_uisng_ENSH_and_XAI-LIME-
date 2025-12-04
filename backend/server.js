const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// Allow configuring CORS origin via env (helps when deploying frontend to other hosts)
// Set CORS_ORIGIN to a string like 'https://your-frontend.example' or '*' for testing.
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));  // For large JSON payloads
app.use(express.urlencoded({ extended: true, limit: '50mb' }));  // For form data (e.g., uploads, feedback)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));  // Optional: Serve temp files if needed

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Routes
app.use('/api/detection', require('./routes/detection'));
app.use('/api/feedback', require('./routes/feedback'));  // New: For user feedback submission
app.use('/api/analytics', require('./routes/analytics'));  // New: For detection statistics and charts

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Backend running. Ready for uploads, feedback, and analytics.' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ msg: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ msg: 'Server error during processing' });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📁 Uploads folder: ${path.join(__dirname, 'uploads')}`);
  console.log(`🐍 Python script: ${path.join(__dirname, 'app.py')}`);
  console.log(`📊 New features: Feedback (/api/feedback) and Analytics (/api/analytics) enabled`);
  // Prune archived files older than ARCHIVE_RETENTION_DAYS (default 30)
  const retentionDays = parseInt(process.env.ARCHIVE_RETENTION_DAYS || '30', 10);
  const archiveBase = path.join(__dirname, 'archive');
  function pruneArchive(baseDir, days) {
    if (!fs.existsSync(baseDir)) return;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const walk = (dir) => {
      fs.readdir(dir, (err, files) => {
        if (err) return console.error('❌ Failed to read archive dir for pruning:', err);
        files.forEach(f => {
          const p = path.join(dir, f);
          fs.stat(p, (err2, stats) => {
            if (err2) return;
            if (stats.isDirectory()) return walk(p);
            if (stats.mtimeMs < cutoff) {
              fs.unlink(p, (err3) => {
                if (err3) console.error('❌ Failed to prune archived file', p, err3);
                else console.log('🧹 Pruned archived file', p);
              });
            }
          });
        });
      });
    };
    walk(baseDir);
  }

  pruneArchive(archiveBase, retentionDays);
  // Optionally spawn Flask app as a child process so its logs appear in this terminal.
  if (process.env.USE_FLASK === 'true') {
      const flaskPort = process.env.FLASK_PORT || '5000';
      // Prefer an explicit PYTHON_PATH, otherwise if Node is running in a conda-activated
      // shell use the CONDA_PREFIX python. Fall back to 'python' on PATH.
      const pythonPath = process.env.PYTHON_PATH || (process.env.CONDA_PREFIX ? require('path').join(process.env.CONDA_PREFIX, process.platform === 'win32' ? 'python.exe' : 'bin/python') : 'python');
      const flaskEnv = Object.assign({}, process.env, { FLASK_PORT: String(flaskPort), FLASK_DEBUG: process.env.FLASK_DEBUG || 'false' });
      console.log(`🐍 Spawning Flask app on port ${flaskPort} using python executable: ${pythonPath}`);
    // Use 'inherit' so Flask logs appear exactly like when running `python app.py`.
    const flaskProcess = spawn(pythonPath, [path.join(__dirname, 'app.py')], { env: flaskEnv, stdio: 'inherit' });
    // When using 'inherit' there is no stdout/stderr streams to pipe; the child's
    // output goes directly to this terminal. We still listen for exit to log it.
    flaskProcess.on('exit', (code, signal) => console.log(`🐍 Flask process exited (code=${code}, signal=${signal})`));
  }
});