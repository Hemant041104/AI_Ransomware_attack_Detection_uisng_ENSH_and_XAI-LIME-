# Backend - Ransomguard

This folder contains the Node/Express backend and the Flask analysis service used by Ransomguard.

Key environment variables

- USE_FLASK: Set to `true` to forward uploads to the Flask service (Node will spawn Flask as a child process).
- PYTHON_PATH: Optional. Full path to a Python executable to spawn (overrides CONDA_PREFIX detection).
- FLASK_PORT: Port that Flask should listen on (default: `6000` unless overridden by code). When Node spawns Flask, it sets `FLASK_PORT` for the child.
- ARCHIVE_UPLOADS: `true` (default) to archive uploaded files under `backend/archive`. Set to `false` to delete uploads after processing.
- ARCHIVE_RETENTION_DAYS: Number of days to keep archived files (default: 30). Files older than this will be pruned at server start.
- MOCK_MODE: `true` to run the mock JS analyzer instead of calling Flask/Python.

Quick dev commands (PowerShell)

1) Use the conda env (recommended) or set `PYTHON_PATH` explicitly:

```powershell
# Activate env and run (preferred)
conda activate ransomware1
cd E:\MultipleFiles\MultipleFiles\backend
$env:USE_FLASK='true'; $env:FLASK_PORT='6000'; npm run dev

# Or without activating env (explicit path)
$env:PYTHON_PATH='C:\Users\You\.conda\envs\ransomware1\python.exe'; $env:USE_FLASK='true'; $env:FLASK_PORT='6000'; npm run dev
```

2) To disable archiving and remove uploads after processing:

```powershell
$env:ARCHIVE_UPLOADS='false'; npm run dev
```

Notes

- If `USE_FLASK=true`, the Node server will attempt to spawn the Python Flask app and forward uploads to it. Ensure the spawned Python has required packages installed (pandas, numpy, joblib, lime, matplotlib, pefile, scikit-learn).
- The backend will create `backend/archive/success` and `backend/archive/error` directories for archived files when enabled.
- For production deployments, run Flask via a proper WSGI server and do not use the development Flask server.

Contact

If you want me to add a single `dev` script to start frontend + backend + Flask together, or add automatic pruning as a periodic task, tell me and I'll implement it.
