import os
import sys
import io
import base64
import tempfile
import cv2
from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image, ImageDraw

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from ac_simulation import ACSimulator
from inference_engine import ONNXInferenceEngine

app = Flask(__name__)
CORS(app)

# Allow large video uploads (up to 500 MB)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "TrainingData.ONNX", "model.onnx")
LABELS_PATH = os.path.join(BASE_DIR, "TrainingData.ONNX", "labels.txt")

ac_simulator = ACSimulator()
onnx_engine = ONNXInferenceEngine(MODEL_PATH, LABELS_PATH)


@app.route("/")
def home():
    return jsonify({
        "system": "Smart Classroom Edge AI System",
        "status": "Online",
        "model_loaded": onnx_engine.is_loaded,
        "endpoints": ["/api/status", "/api/simulate", "/api/analyze_video", "/api/history", "/api/reset_timer"]
    })


@app.route("/api/status", methods=["GET"])
def get_status():
    data = ac_simulator.get_status()
    data["model_loaded"] = onnx_engine.is_loaded
    return jsonify(data)


@app.route("/api/simulate", methods=["POST"])
def simulate_occupancy():
    data = request.json or {}
    level = data.get("occupancy", "MEDIUM").upper()
    count = data.get("person_count", None)
    if level not in ["LOW", "MEDIUM", "HIGH"]:
        return jsonify({"error": "Use LOW, MEDIUM, or HIGH"}), 400
    updated = ac_simulator.evaluate_occupancy(level, person_count=count, source="Manual")
    return jsonify({"message": f"Simulated {level}", "status": updated})


@app.route("/api/reset_timer", methods=["POST"])
def reset_timer():
    ac_simulator.reset_running_time()
    return jsonify({"message": "Timer reset", "status": ac_simulator.get_status()})


@app.route("/api/history", methods=["GET"])
def get_history():
    return jsonify({"history": ac_simulator.get_history()})


def _level_to_ac(level):
    """Return AC state and temperature for a given occupancy level."""
    if level == "LOW":
        return {"ac_state": "OFF", "temperature": None}
    elif level == "MEDIUM":
        return {"ac_state": "ON", "temperature": 24}
    elif level == "HIGH":
        return {"ac_state": "ON", "temperature": 20}
    return {"ac_state": "OFF", "temperature": None}


def _sec_to_label(sec):
    m = int(sec) // 60
    s = int(sec) % 60
    return f"{m:02d}:{s:02d}"


def _draw_boxes(pil_img, predictions):
    """Draw bounding boxes on a PIL image and return annotated copy."""
    annotated = pil_img.copy().convert("RGB")
    draw = ImageDraw.Draw(annotated)
    w, h = annotated.size
    for pred in predictions:
        bbox = pred["boundingBox"]
        left  = int(bbox["left"]  * w)
        top   = int(bbox["top"]   * h)
        bw    = int(bbox["width"] * w)
        bh    = int(bbox["height"]* h)
        right  = left + bw
        bottom = top  + bh
        # Draw box
        draw.rectangle([left, top, right, bottom], outline=(37, 99, 235), width=3)
        # Label background
        label = f"Person {int(pred['probability']*100)}%"
        draw.rectangle([left, max(0, top - 20), left + 90, top], fill=(37, 99, 235))
        draw.text((left + 4, max(0, top - 18)), label, fill=(255, 255, 255))
    return annotated


@app.route("/api/analyze_video", methods=["POST"])
def analyze_video():
    """
    Full video analysis for playback synchronization.

    Samples a frame every SAMPLE_INTERVAL seconds, runs ONNX inference,
    records occupancy + AC state at each timestamp, and pre-computes
    cumulative AC running time so the frontend can sync the dashboard
    cards as the video plays.

    Returns:
        duration_sec     - total video duration
        fps              - original video fps
        frames_analyzed  - number of sampled frames
        frame_results    - list of per-frame dicts:
            timestamp_sec     : float  (video position of this sample)
            timestamp_label   : str    ("MM:SS")
            person_count      : int
            occupancy_level   : "LOW" | "MEDIUM" | "HIGH"
            ac_state          : "ON" | "OFF"
            temperature       : int | null
            cumulative_ac_sec : float  (total AC-ON seconds up to this point)
            snapshot_b64      : str    (base64 JPEG of annotated frame)
    """
    SAMPLE_INTERVAL = 1.0   # seconds between samples
    MAX_FRAMES      = 120   # cap (120 × 1s = 2-minute video fully covered)

    if "file" not in request.files:
        return jsonify({"error": "No video file provided"}), 400

    video_file = request.files["file"]
    if not video_file.filename:
        return jsonify({"error": "Empty filename"}), 400

    suffix = os.path.splitext(video_file.filename)[-1].lower() or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp_path = tmp.name
        video_file.save(tmp_path)

    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            return jsonify({"error": "Could not open video file. Use MP4, AVI, MOV, or WebM."}), 400

        fps            = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames   = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration_sec   = (total_frames / fps) if fps > 0 else 0.0

        # Dynamically scale sample interval for longer videos so the entire duration is covered
        if duration_sec > MAX_FRAMES:
            sample_interval = duration_sec / float(MAX_FRAMES)
        else:
            sample_interval = SAMPLE_INTERVAL

        frame_step     = max(1, int(fps * sample_interval))

        frame_results      = []
        cumulative_ac_sec  = 0.0
        prev_timestamp     = 0.0
        prev_ac_on         = False
        sample_count       = 0
        frame_idx          = 0

        while sample_count < MAX_FRAMES:
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame_bgr = cap.read()
            if not ret:
                break

            timestamp_sec = frame_idx / fps

            # ONNX inference
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            pil_img   = Image.fromarray(frame_rgb)
            result    = onnx_engine.predict_pil(pil_img)

            level       = result["occupancy_level"]
            person_count= result["person_count"]
            predictions = result["predictions"]
            ac          = _level_to_ac(level)

            # Accumulate AC running time (trapezoidal: time gap since last sample)
            if prev_ac_on and sample_count > 0:
                gap = timestamp_sec - prev_timestamp
                cumulative_ac_sec += gap

            prev_ac_on    = ac["ac_state"] == "ON"
            prev_timestamp = timestamp_sec

            # Store raw predictions (bounding boxes) — used by frontend canvas overlay
            # No longer sending full base64 image per frame (saves payload size)
            frame_results.append({
                "frame_index"      : frame_idx,
                "timestamp_sec"    : round(timestamp_sec, 2),
                "timestamp_label"  : _sec_to_label(timestamp_sec),
                "person_count"     : person_count,
                "occupancy_level"  : level,
                "ac_state"         : ac["ac_state"],
                "temperature"      : ac["temperature"],
                "cumulative_ac_sec": round(cumulative_ac_sec, 1),
                "predictions"      : predictions,   # [{probability, boundingBox:{left,top,width,height}}, ...]
            })

            frame_idx    += frame_step
            sample_count += 1

        cap.release()

        if not frame_results:
            return jsonify({"error": "No readable frames found in video."}), 400

        # Final overall occupancy = majority level across all frames
        counts = {"LOW": 0, "MEDIUM": 0, "HIGH": 0}
        for f in frame_results:
            counts[f["occupancy_level"]] += 1
        overall_level = max(counts, key=counts.get)
        overall_ac    = _level_to_ac(overall_level)
        total_ac_sec  = frame_results[-1]["cumulative_ac_sec"]

        # Sync the backend AC simulator to final state
        ac_simulator.evaluate_occupancy(
            overall_level,
            person_count=round(sum(f["person_count"] for f in frame_results) / len(frame_results)),
            source="Video Playback"
        )

        return jsonify({
            "video_filename"  : video_file.filename,
            "duration_sec"    : round(duration_sec, 2),
            "fps"             : round(fps, 2),
            "frames_analyzed" : len(frame_results),
            "overall_level"   : overall_level,
            "overall_ac"      : overall_ac,
            "total_ac_sec"    : round(total_ac_sec, 1),
            "frame_results"   : frame_results,   # frontend uses this for live sync
        })

    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


if __name__ == "__main__":
    print("Starting Smart Classroom Backend API on http://127.0.0.1:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
