const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');  // For real app.py (commented in mock mode)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');  // For mock hash
const Detection = require('../models/Detection');
const router = express.Router();
const axios = require('axios');
const FormData = require('form-data');

// Multer configuration (same as before)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 10 * 1024 * 1024 * 1024  // 10GB
  },
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.exe' || 
        path.extname(file.originalname).toLowerCase() === '.msi') {
      cb(null, true);
    } else {
      cb(new Error('Only .exe and .msi files are allowed'), false);
    }
  }
});

// Mock entropy calculation in Node.js (simple Shannon, chunked for large files)
function calculateMockEntropy(filePath) {
  const buffer = fs.readFileSync(filePath);  // For small files; for 10GB, read in chunks below
  const bytes = new Uint8Array(buffer);
  const freq = {};
  bytes.forEach(b => freq[b] = (freq[b] || 0) + 1);
  let entropy = 0;
  const len = bytes.length;
  for (let i = 0; i < 256; i++) {
    const p = (freq[i] || 0) / len;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

// For large files: Chunked entropy (replace above if needed)
function calculateChunkedEntropy(filePath) {
  const freq = new Array(256).fill(0);
  let totalBytes = 0;
  const chunkSize = 1024 * 1024;  // 1MB
  const fd = fs.openSync(filePath, 'r');
  let buffer = Buffer.alloc(chunkSize);
  while (true) {
    const bytesRead = fs.readSync(fd, buffer, 0, chunkSize, null);
    if (bytesRead === 0) break;
    for (let i = 0; i < bytesRead; i++) {
      freq[buffer[i]]++;
    }
    totalBytes += bytesRead;
  }
  fs.closeSync(fd);
  let entropy = 0;
  for (let i = 0; i < 256; i++) {
    const p = freq[i] / totalBytes;
    if (p > 0) entropy -= p * Math.log2(p);
  }
  return entropy;
}

// POST /api/detection/upload
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: 'No file uploaded or invalid file type' });
    }

    const filePath = req.file.path;
    const fileSize = req.file.size;
    const filename = req.file.originalname;

    console.log(`📤 Processing file: ${filename} (${(fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB)`);

    let prediction = {
      isRansomware: false,  // Safe fallback
      entropyScore: 0,
      hash: 'unknown',
      confidence: 0,
      explanation: { features: [] }
    };

    const mockMode = process.env.MOCK_MODE === 'true';  // From .env

    if (mockMode) {
      // MOCK MODE: Simulate prediction without app.py
      console.log('🔧 Mock mode enabled - Simulating prediction');
      
      // Calculate mock entropy (use chunked for large files)
      const entropy = fileSize > 100 * 1024 * 1024 ? calculateChunkedEntropy(filePath) : calculateMockEntropy(filePath);
      
      // Mock hash (SHA256)
      const hash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
      
      // Simulate ransomware: High entropy (>7) or random
      const isRansomware = entropy > 7 || Math.random() > 0.6;  // 40% chance for demo
      const confidence = Math.min(entropy / 8, 1.0) + (Math.random() * 0.2);  // 0-1
      
      // Mock LIME features
      prediction = {
        isRansomware,
        entropyScore: entropy,
        hash,
        confidence: Math.min(confidence, 1.0),
        explanation: {
          features: [
            { name: 'Entropy Score', importance: (entropy / 8) * 100 },
            { name: 'Hash Mismatch', importance: Math.random() * 50 + 20 },
            { name: 'File Size Patterns', importance: (fileSize / (10 * 1024 * 1024 * 1024)) * 30 }
          ]
        }
      };
      
      console.log('✅ Mock prediction:', prediction.isRansomware ? 'Ransomware' : 'Safe');
    } else {
      // REAL MODE: Either forward to Flask HTTP service or spawn a CLI Python worker.
      const useFlask = process.env.USE_FLASK === 'true';
      if (useFlask) {
        console.log('🔁 Forwarding upload to Flask service');
        const flaskPort = process.env.FLASK_PORT || 6000;
        const url = `http://127.0.0.1:${flaskPort}/analyze`;

        const form = new FormData();
        form.append('file', fs.createReadStream(filePath), { filename });

        axios.post(url, form, { headers: form.getHeaders(), timeout: 2 * 60 * 1000 })
          .then(async (response) => {
            const data = response.data || {};
            // Map Flask JSON shape to the internal prediction shape expected by saveAndRespond
              prediction = {
                isRansomware: (data.label === 'Ransomware') || false,
                entropyScore: data.entropyScore ?? data.file_entropy ?? 0,
                hash: data.sha256 || data.hash || 'unknown',
                confidence: (typeof data.prob === 'number') ? data.prob : (data.confidence || 0),
                // Preserve LIME features and include the lime image URL (if Flask returned it)
                explanation: Object.assign(
                  Array.isArray(data.top_features) ? { features: data.top_features } : (data.explanation || { features: [] }),
                  { lime_image: data.lime_image || null }
                ),
                // keep raw for debugging
                _raw: data
              };
            // Ensure fileSize is present
            prediction.fileSize = prediction.fileSize || fileSize;
            await saveAndRespond();
          })
          .catch(async (err) => {
            console.error('❌ Flask analyze error:', err.message || err);
            prediction.hash = 'flask_error';
            await saveAndRespond();
          });

        return; // handled async above
      }

      // FALLBACK: spawn CLI Python worker (original behavior)
      console.log('🐍 Running real app.py for prediction (spawn)');
      const pythonProcess = spawn(process.env.PYTHON_PATH || 'python', [path.join(__dirname, '../app.py'), filePath]);

      let stdoutData = '';
      let stderrData = '';

      pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      pythonProcess.on('close', async (code) => {
        console.log(`🐍 Python exited with code ${code}`);

        if (code === 0 && stdoutData) {
          try {
            prediction = JSON.parse(stdoutData.trim());
            console.log('✅ Real prediction:', prediction.isRansomware ? 'Ransomware' : 'Safe');
          } catch (parseErr) {
            console.error('❌ Invalid JSON from app.py:', parseErr.message);
            prediction.hash = 'parse_error';
          }
        } else {
          console.error('❌ app.py error:', stderrData || 'Unknown');
          prediction.hash = 'python_error';
        }

        // Continue to save and respond (below)
        await saveAndRespond();
      });

      // For real mode, return early if Python is async
      return;  // Wait for close event
    }

    // Common save logic (for both mock and real)
    async function saveAndRespond() {
      prediction.fileSize = fileSize;  // Ensure fileSize is added
      
      const detection = new Detection({
        filename,
        fileSize,
        isRansomware: prediction.isRansomware || false,
        entropyScore: prediction.entropyScore || 0,
        hash: prediction.hash || 'unknown',
        confidence: prediction.confidence || 0,
        explanation: prediction.explanation || { features: [] }
      });
      await detection.save();
      
      // Archive uploaded file instead of deleting it so we can inspect samples later.
      // Archive directory: backend/archive/<success|error>
      const archiveUploads = (process.env.ARCHIVE_UPLOADS || 'true').toLowerCase() === 'true';
      const archiveBase = path.join(__dirname, '../archive');
      if (archiveUploads) {
        try { fs.mkdirSync(archiveBase, { recursive: true }); } catch (e) { console.error('⚠️ Failed to create archive base dir:', e); }
      }

      // Decide subfolder based on prediction result. If prediction contains an explicit
      // error marker or hash set to an error code, treat as 'error', else 'success'.
      const isError = !!(prediction && (prediction.error || prediction.hash === 'flask_error' || prediction.hash === 'python_error' || prediction.hash === 'parse_error'));
      const subfolder = isError ? 'error' : 'success';
      const archiveDir = path.join(archiveBase, subfolder);
      if (archiveUploads && !fs.existsSync(archiveDir)) {
        try { fs.mkdirSync(archiveDir, { recursive: true }); } catch (e) { console.error('⚠️ Failed to create archive subdir:', e); }
      }

      function moveToArchive(src, destDir, attempts = 6, delay = 500) {
        if (!archiveUploads) return deleteFallback(src);
        let tries = 0;
        // Use timestamped filename and prefer the original filename for easier inspection
        const destName = `${Date.now()}-${filename || path.basename(src)}`;
        const dest = path.join(destDir, destName);
        const attempt = () => {
          fs.rename(src, dest, (err) => {
            if (!err) {
              console.log('📦 File archived to', dest);
              return;
            }
            tries += 1;
            if (tries <= attempts) {
              console.warn(`⚠️ Archive attempt ${tries} failed: ${err.code || err}. retrying in ${delay}ms`);
              setTimeout(attempt, delay);
            } else {
              console.error('⚠️ Archive failed after retries:', err);
              // As a last resort, try to delete to avoid filling disk
              deleteFallback(src);
            }
          });
        };
        attempt();
      }

      function deleteFallback(src) {
        fs.unlink(src, (unlinkErr) => {
          if (!unlinkErr) console.log('🗑️ File deleted as fallback');
          else console.error('❌ Fallback delete also failed:', unlinkErr);
        });
      }

      moveToArchive(filePath, archiveDir, 6, 500);
      
      res.json(detection);
    }

    if (mockMode) {
      await saveAndRespond();  // Sync for mock
    }

  } catch (err) {
    console.error('❌ Upload error:', err);
    res.status(500).json({ msg: 'File processing failed: ' + err.message });
  }
});

// GET /api/detection (unchanged)
router.get('/', async (req, res) => {
  try {
    const detections = await Detection.find().sort({ timestamp: -1 }).limit(50);
    res.json(detections);
  } catch (err) {
    console.error('❌ Fetch error:', err);
    res.status(500).json({ msg: 'Failed to fetch history' });
  }
});

module.exports = router;