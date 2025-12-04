import os
import math
import hashlib
from collections import Counter
import joblib
import numpy as np
import pandas as pd

try:
    import pefile
except ImportError:
    pefile = None

# ============================
# Paths and Constants
# ============================
WORK_DIR = os.getcwd()
FEATURES_CSV = os.path.join(WORK_DIR, "features.csv")
BEST_MODEL_PATH = os.path.join(WORK_DIR, "best_model.pkl")
SCALER_MEAN = os.path.join(WORK_DIR, "esnh_output", "scaler_mean.npy")
SCALER_SCALE = os.path.join(WORK_DIR, "esnh_output", "scaler_scale.npy")

# ============================
# Feature Handling
# ============================
def load_feature_template():
    df = pd.read_csv(FEATURES_CSV, nrows=1)
    df = df.drop(columns=[c for c in ["label", "path", "filename", "sha256", "Unnamed: 0", "index"]
                          if c in df.columns],
                 errors="ignore")
    return df.columns.tolist()

FEATURE_COLUMNS = load_feature_template()

# ============================
# Entropy and PE Feature Extraction
# ============================
def file_entropy_from_counts(counter, total_bytes):
    if total_bytes == 0:
        return 0.0
    return -sum((c / total_bytes) * math.log2(c / total_bytes) for c in counter.values() if c)

def extract_stream_stats(path):
    byte_counter = Counter()
    window_entropies = []
    file_size = os.path.getsize(path)
    with open(path, "rb") as f:
        while chunk := f.read(1024):
            byte_counter.update(chunk)
            window_entropies.append(file_entropy_from_counts(Counter(chunk), len(chunk)))
    global_entropy = file_entropy_from_counts(byte_counter, sum(byte_counter.values()))
    return {
        "file_size": file_size,
        "file_entropy": global_entropy,
        "sw_ent_mean": np.mean(window_entropies),
        "sw_ent_std": np.std(window_entropies),
        "sw_ent_min": np.min(window_entropies),
        "sw_ent_max": np.max(window_entropies),
    }

def extract_pe_features(path):
    feats = {"n_imports": 0, "n_sections": 0, "dll_count": 0, "overlay_size": 0, "rsrc_size": 0}
    if pefile is None:
        return feats
    try:
        pe = pefile.PE(path, fast_load=True)
        feats["n_sections"] = len(pe.sections)
        feats["overlay_size"] = max(0, os.path.getsize(path) - max(
            (s.PointerToRawData + s.SizeOfRawData) for s in pe.sections))
        feats["dll_count"] = len(getattr(pe, "DIRECTORY_ENTRY_IMPORT", []))
        feats["n_imports"] = sum(len(d.imports) for d in getattr(pe, "DIRECTORY_ENTRY_IMPORT", []))
    except Exception:
        pass
    return feats

# ============================
# Model Loading
# ============================
_MODEL = None
_SCALER = None

def load_artifacts():
    global _MODEL, _SCALER

    if _MODEL is None:
        if not os.path.exists(BEST_MODEL_PATH):
            raise FileNotFoundError("best_model.pkl not found")
        _MODEL = joblib.load(BEST_MODEL_PATH)

    if _SCALER is None and os.path.exists(SCALER_MEAN) and os.path.exists(SCALER_SCALE):
        mean = np.load(SCALER_MEAN)
        scale = np.load(SCALER_SCALE)
        from sklearn.preprocessing import StandardScaler
        scaler = StandardScaler()
        scaler.mean_, scaler.scale_, scaler.var_ = mean, scale, scale ** 2
        _SCALER = scaler

    return _MODEL, _SCALER

# ============================
# Feature Vector Builder
# ============================
def build_feature_vector_from_path(path):
    stream_feats = extract_stream_stats(path)
    pe_feats = extract_pe_features(path)
    merged = {**stream_feats, **pe_feats}
    return np.array([[merged.get(c, 0) for c in FEATURE_COLUMNS]], dtype=np.float32), merged

def sha256_of_file(path, chunk_size=1024 * 1024):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            h.update(chunk)
    return h.hexdigest()

# ============================
# Prediction Function
# ============================
def predict_single(path):
    model, scaler = load_artifacts()
    feat_vec, merged = build_feature_vector_from_path(path)

    # Fix scaler dimension mismatch
    if scaler is not None:
        try:
            scaled = scaler.transform(feat_vec)
        except ValueError:
            n_scaler = len(scaler.mean_)
            n_feat = feat_vec.shape[1]
            if n_feat > n_scaler:
                feat_vec = feat_vec[:, :n_scaler]
            elif n_feat < n_scaler:
                pad = np.zeros((1, n_scaler - n_feat))
                feat_vec = np.hstack((feat_vec, pad))
            scaled = scaler.transform(feat_vec)
    else:
        scaled = feat_vec

    probs = model.predict_proba(scaled)[0]
    pred = int(model.predict(scaled)[0])

    return {
        "filename": os.path.basename(path),
        "sha256": sha256_of_file(path),
        "prob": float(probs[1]) if len(probs) > 1 else float(probs[0]),
        "label": "Ransomware" if pred == 1 else "Benign",
        "features": scaled,
    }

# ============================
# LIME Explainability + Human Interpretation
# ============================
def generate_lime_explanation(model, scaler, sample, feature_names, output_path="static/lime_explanation.png"):
    """
    Generate a LIME explanation image and return top-5 most influential features with meanings.
    """
    import lime
    import lime.lime_tabular
    # Use a non-GUI backend for matplotlib so LIME image generation works in headless
    # environments (avoids "Starting a Matplotlib GUI outside of the main thread" warnings).
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    expected_features = model.n_features_in_ if hasattr(model, "n_features_in_") else sample.shape[1]
    if sample.shape[1] != expected_features:
        sample = sample[:, :expected_features]

    explainer = lime.lime_tabular.LimeTabularExplainer(
        training_data=np.zeros((10, expected_features)),
        feature_names=feature_names[:expected_features],
        class_names=["Benign", "Ransomware"],
        mode="classification"
    )

    def predict_fn(x):
        if scaler is not None:
            try:
                x = scaler.transform(x)
            except Exception:
                pass
        if x.shape[1] != expected_features:
            x = x[:, :expected_features]
        return model.predict_proba(x)

    exp = explainer.explain_instance(
        data_row=sample[0],
        predict_fn=predict_fn,
        num_features=10
    )

    # Save explanation plot
    fig = exp.as_pyplot_figure()
    fig.savefig(output_path, bbox_inches="tight")
    plt.close(fig)

    # Extract top features
    top_features = sorted(exp.as_list(), key=lambda x: abs(x[1]), reverse=True)[:5]
    feature_summary = [{"feature": f, "impact": round(float(v), 4)} for f, v in top_features]

    # Human-readable explanations
    explanations = {
        "file_entropy": "High file entropy suggests the file may be packed or encrypted, common in ransomware.",
        "sw_ent_mean": "Sliding window entropy shows randomness; high mean implies code obfuscation.",
        "overlay_size": "Large overlay sections might contain hidden data or payloads.",
        "dll_count": "Many DLLs indicate the file uses complex system libraries, possibly suspicious.",
        "n_imports": "High number of imported functions may indicate advanced system access.",
        "has_signature": "Signed executables are typically legitimate; missing signatures raise suspicion.",
        "rsrc_size": "Large resources can hide encrypted or malicious content.",
        "api_CreateFileW": "Creates or modifies files — often used to encrypt user data.",
        "api_CryptEncrypt": "Uses encryption APIs — strongly correlated with ransomware.",
        "api_CreateProcessW": "Creates new processes, possibly to spread infection or start encryption routines.",
        "api_InternetConnectA": "May indicate communication with a remote command server.",
        "crypto_kw": "Cryptographic terms (AES, RSA, etc.) found in code — typical for ransomware."
    }

    # Add meanings
    for f in feature_summary:
        key = f["feature"].split()[0]
        f["meaning"] = explanations.get(key, "General influence on model decision.")

    return output_path, feature_summary

# ============================
# CLI Mode
# ============================
if __name__ == "__main__":
    import argparse, json
    p = argparse.ArgumentParser()
    p.add_argument("file")
    args = p.parse_args()

    result = predict_single(args.file)
    print(json.dumps(result, indent=2))

    try:
        model, scaler = load_artifacts()
        lime_path, summary = generate_lime_explanation(model, scaler, result["features"], FEATURE_COLUMNS)
        print("\nLIME explanation saved to:", lime_path)
        print("Top 5 contributing features with explanations:\n", json.dumps(summary, indent=2))
    except Exception as e:
        print("LIME generation skipped:", e)
