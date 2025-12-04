from flask import Flask, render_template_string, request, jsonify, url_for
import os
import json
import numpy as np
from predict import (
        predict_single,
        generate_lime_explanation,
        FEATURE_COLUMNS,
        load_artifacts,
)

# ----------------------------
# Flask setup
# ----------------------------
app = Flask(__name__)
UPLOAD_DIR = os.path.join(os.getcwd(), "uploads")
STATIC_DIR = os.path.join(os.getcwd(), "static")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024 * 1024  # 10 GB

# ----------------------------
# HTML Template (UI + Chart)
# ----------------------------
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Ransomware Detection</title>
<style>
    body {
        font-family: 'Segoe UI', Arial, sans-serif;
        background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
        color: #ffffff;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
    }
    h1 {
        color: #00c6ff;
        font-size: 2.4rem;
        margin-bottom: 15px;
        text-shadow: 0 0 10px #00c6ff;
    }
    .upload-box {
        background: rgba(255,255,255,0.1);
        padding: 30px;
        border-radius: 20px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.4);
        width: 90%;
        max-width: 480px;
        text-align: center;
    }
    input[type=file] {
        color: #fff;
        margin-top: 10px;
        margin-bottom: 15px;
        border: none;
    }
    button {
        background-color: #00c6ff;
        color: #141E30;
        font-weight: bold;
        border: none;
        padding: 12px 25px;
        border-radius: 12px;
        cursor: pointer;
        transition: 0.3s;
    }
    button:hover {
        background-color: #ffffff;
        color: #0f2027;
    }
    #progress-container {
        display: none;
        margin-top: 10px;
        width: 100%;
    }
    #progress-bar {
        width: 0%;
        height: 10px;
        background-color: #00c6ff;
        border-radius: 5px;
        transition: width 0.3s ease-in-out;
    }
    #result {
        margin-top: 20px;
        background: rgba(255,255,255,0.1);
        padding: 15px;
        border-radius: 12px;
        word-wrap: break-word;
    }
    .explain-box img {
        margin-top: 15px;
        border-radius: 12px;
        max-width: 100%;
        border: 2px solid #00c6ff;
    }
    canvas {
        margin-top: 15px;
        background: #fff;
        border-radius: 12px;
    }
    #featureText {
        text-align: left;
        margin-top: 15px;
        font-size: 0.95rem;
        line-height: 1.4;
    }
    @media (max-width: 500px) {
        .upload-box { padding: 20px; }
        h1 { font-size: 1.8rem; }
    }
</style>
</head>
<body>
    <h1>🔒 Ransomware Detection</h1>
    <div class="upload-box">
        <p>Upload a Windows executable (.exe) file to analyze it.</p>
        <form id="uploadForm" enctype="multipart/form-data">
            <input type="file" id="file" name="file" accept=".exe" required />
            <br />
            <button type="submit">Upload & Analyze</button>
        </form>
        <div id="progress-container">
            <div id="progress-bar"></div>
        </div>
        <div id="loading" style="display:none; margin-top:10px;">⏳ Analyzing file, please wait...</div>
        <div id="result"></div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
    const form = document.getElementById('uploadForm');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const resultDiv = document.getElementById('result');
    const loadingDiv = document.getElementById('loading');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fileInput = document.getElementById('file');
        if (!fileInput.files.length) {
            alert("Please select a file first!");
            return;
        }

        const formData = new FormData();
        formData.append('file', fileInput.files[0]);
        resultDiv.innerHTML = '';
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        loadingDiv.style.display = 'block';

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/analyze', true);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                progressBar.style.width = percent + '%';
            }
        };

        xhr.onload = () => {
            loadingDiv.style.display = 'none';
            if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText);
                if (data.error) {
                    resultDiv.innerHTML = "<b style='color:red;'>Error:</b> " + data.error;
                } else {
                    const color = data.label === "Ransomware" ? "red" : "lime";
                    const labels = data.top_features.map(f => f.feature);
                    const values = data.top_features.map(f => f.impact);

                    // Build explanation text
                    const textHtml = data.top_features.map(f =>
                        `<b>${f.feature}</b> (${f.impact > 0 ? '↑' : '↓'}): ${f.meaning}`
                    ).join('<br><br>');

                    resultDiv.innerHTML = `
                        <b>Filename:</b> ${data.filename}<br>
                        <b>SHA256:</b> ${data.sha256}<br>
                        <b>Label:</b> <span style="color:${color}; font-weight:bold;">${data.label}</span><br>
                        <b>Probability:</b> ${(data.prob * 100).toFixed(2)}%<br><br>
                        <div class="explain-box">
                            <h3>🧠 Why this prediction?</h3>
                            <img src="${data.lime_image}" alt="LIME Explanation" />
                            <canvas id="featureChart" width="400" height="250"></canvas>
                            <div id="featureText">${textHtml}</div>
                        </div>
                    `;

                    // Draw feature impact chart
                    const ctx = document.getElementById('featureChart');
                    new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: 'Feature Impact',
                                data: values,
                                backgroundColor: values.map(v => v > 0 ? 'rgba(255, 99, 132, 0.7)' : 'rgba(54, 162, 235, 0.7)'),
                                borderColor: values.map(v => v > 0 ? 'rgba(255, 99, 132, 1)' : 'rgba(54, 162, 235, 1)'),
                                borderWidth: 1
                            }]
                        },
                        options: {
                            scales: {
                                x: { ticks: { color: '#fff' } },
                                y: { ticks: { color: '#fff' } }
                            },
                            plugins: { legend: { labels: { color: '#fff' } } }
                        }
                    });
                }
            } else {
                resultDiv.innerHTML = "<b style='color:red;'>Error:</b> " + xhr.statusText;
            }
        };

        xhr.onerror = () => {
            loadingDiv.style.display = 'none';
            resultDiv.innerHTML = "<b style='color:red;'>Error:</b> Upload failed.";
        };

        xhr.send(formData);
    });
    </script>
</body>
</html>
"""

# ----------------------------
# Flask Routes
# ----------------------------
@app.route("/")
def index():
        return render_template_string(HTML_TEMPLATE)

@app.route("/analyze", methods=["POST"])
def analyze():
        try:
                if "file" not in request.files:
                        return jsonify({"error": "No file uploaded"}), 400

                uploaded_file = request.files["file"]
                if uploaded_file.filename == "":
                        return jsonify({"error": "No file selected"}), 400

                safe_path = os.path.join(UPLOAD_DIR, uploaded_file.filename)
                uploaded_file.save(safe_path)
                print(f"[flask] /analyze called, saved upload to: {safe_path}")

                # Run detection
                result = predict_single(safe_path)
                print(f"[flask] Prediction computed: filename={result.get('filename')}, label={result.get('label')}, prob={result.get('prob')}")

                # Load model + scaler for LIME
                model, scaler = load_artifacts()

                # Generate LIME explanation (image + top features with meanings)
                lime_path = os.path.join(STATIC_DIR, f"lime_{uploaded_file.filename}.png")
                lime_image, top_features = generate_lime_explanation(
                        model, scaler, result["features"], FEATURE_COLUMNS, lime_path
                )

                # Use an absolute external URL so the image can be loaded by the React frontend
                # even when Flask runs on a different host/port than the frontend.
                try:
                    result["lime_image"] = url_for('static', filename=os.path.basename(lime_image), _external=True)
                except RuntimeError:
                    # If url_for cannot build an external URL (no request context), fall back to path
                    result["lime_image"] = url_for('static', filename=os.path.basename(lime_image))
                result["top_features"] = top_features
                print(f"[flask] LIME image saved to: {lime_image}; top features: {top_features}")

                def convert_np(obj):
                        if isinstance(obj, (np.integer,)):
                                return int(obj)
                        elif isinstance(obj, (np.floating,)):
                                return float(obj)
                        elif isinstance(obj, (np.ndarray,)):
                                return obj.tolist()
                        return obj

                return app.response_class(
                        response=json.dumps(result, default=convert_np),
                        status=200,
                        mimetype="application/json"
                )

        except Exception as e:
                import traceback
                traceback.print_exc()
                return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    # Allow configuring host/port/debug via environment so the Node server
    # can spawn this process with custom settings.
    host = os.getenv('FLASK_HOST', '127.0.0.1')
    port = int(os.getenv('FLASK_PORT', os.getenv('PORT', '5000')))
    debug_env = os.getenv('FLASK_DEBUG', 'false')
    debug = debug_env.lower() == 'true' if isinstance(debug_env, str) else bool(debug_env)
    # When spawned by another process we usually want to disable the reloader
    # to avoid double process creation (Flask development reloader forks).
    use_reloader = False
    # Start Flask
    app.run(host=host, port=port, debug=debug, use_reloader=use_reloader)