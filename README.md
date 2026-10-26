# Smart Classroom Edge AI System

> **Edge AI-powered classroom occupancy detection** with automated AC climate control and real-time React dashboard.

---

## 🏗️ System Architecture

```
📷 Camera / Video Frame
        │
        ▼
 🤖 ONNX Edge AI Model (model.onnx)  ← Runs LOCALLY on edge device
   [Custom Vision — YOLOv2-style Person Detection]
        │
        │ person_count → LOW / MEDIUM / HIGH
        ▼
 🐍 Flask Backend API (Python)
   ├── AC Simulation Logic
   ├── Running Time Tracker
   └── History Log
        │
        │ JSON via REST API
        ▼
 ⚛️  React Dashboard (Vite)
   ├── Occupancy Card
   ├── AC Status Card
   ├── Temperature Card
   ├── AC Runtime Card
   ├── Inference View (Live Annotated Frame)
   └── Occupancy Timeline Chart
```

---

## 🤖 AC Simulation Logic

| Occupancy | People | AC State | Temperature |
|-----------|--------|----------|-------------|
| LOW       | 1–2    | OFF      | —           |
| MEDIUM    | 3–9    | ON       | 24°C        |
| HIGH      | 10+    | ON       | 20°C        |
| Janitor   | countless| OFF    | --

---

## 📁 Project Structure

```
EdegAi Project/
│
├── TrainingData.ONNX/          ← Custom Vision ONNX model (from Data Science team)
│   ├── model.onnx              ← 44MB YOLOv2 ONNX person detection model
│   ├── labels.txt              ← Class labels (Person)
│   ├── metadata_properties.json
│   └── python/                 ← Reference inference scripts
│
├── backend/
│   ├── app.py                  ← Flask REST API (main entry point)
│   ├── ac_simulation.py        ← AC control logic + runtime timer
│   ├── inference_engine.py     ← ONNX Runtime wrapper for person detection
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Header.jsx
│       │   ├── OccupancyCard.jsx
│       │   ├── ACStatusCard.jsx
│       │   ├── TemperatureCard.jsx
│       │   ├── RuntimeCard.jsx
│       │   ├── OccupancyChart.jsx
│       │   ├── DetectionView.jsx
│       │   └── SimulationControls.jsx
│       ├── App.jsx             ← Main dashboard app
│       └── index.css           ← Dark glassmorphism design
│
├── data/                       ← Sample classroom test images
│   ├── low_occupancy.jpg
│   ├── medium_occupancy.jpg
│   └── high_occupancy.jpg
│
├── Dockerfile                  ← Docker container for backend
├── docker-compose.yml          ← Full system compose
├── start.ps1                   ← One-click launch script (Windows)
└── README.md
```

---

## 🚀 Quick Start

### Option A — Direct Run (Development)

**Step 1: Start the Flask Backend**
```powershell
cd "S:\EdegAi Project"
python backend\app.py
```

**Step 2: Start the React Dashboard** (new terminal)
```powershell
cd "S:\EdegAi Project\frontend"
npm run dev
```

**Step 3: Open dashboard at** → [http://localhost:5173](http://localhost:5173)

### Option B — One-Click Launch
```powershell
cd "S:\EdegAi Project"
.\start.ps1
```

### Option C — Docker
```powershell
docker-compose up --build
```

---

## 🌐 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/status` | Live occupancy, AC state, temp, timer |
| POST | `/api/simulate` | Manually simulate LOW/MEDIUM/HIGH |
| POST | `/api/infer` | Run ONNX AI on image (sample or upload) |
| GET | `/api/history` | Occupancy event history log |
| POST | `/api/reset_timer` | Reset AC running time counter |

### `/api/simulate` example:
```json
POST /api/simulate
{ "occupancy": "HIGH", "person_count": 12 }
```

### `/api/infer` example (sample):
```json
POST /api/infer
{ "sample": "medium" }
```

### `/api/status` response:
```json
{
  "occupancy": "MEDIUM",
  "person_count": 5,
  "ac_state": "ON",
  "temperature": 24,
  "running_time": "00:25:32",
  "timestamp": "2026-10-02 14:30:00",
  "model_loaded": true
}
```

---

## 🤖 AI Model Details

- **Type**: Microsoft Custom Vision — YOLOv2-style Object Detection (ONNX)
- **File**: `TrainingData.ONNX/model.onnx` (44MB)
- **Input**: RGB image (resized to ~512×512)
- **Output**: Bounding boxes for `Person` class with confidence scores
- **Occupancy classification**: count-based threshold (≤2 = LOW, 3–9 = MEDIUM, 10+ = HIGH)
- **Runtime**: ONNX Runtime (CPU, runs locally on edge device)

---

## 👥 Team Responsibilities

| Role | Responsibility |
|------|---------------|
| Data Scientists | Model training, labeling, ONNX export |
| App Developers | Edge API, AC Simulation, Dashboard, GitHub |
| Product Owner | Requirements, demo coordination |
| Project Manager | Sprint coordination |

---

## 🔧 Technologies Used

| Component | Technology |
|-----------|-----------|
| AI Model | Microsoft Custom Vision (ONNX) |
| Edge Inference | Python + ONNX Runtime |
| Backend API | Python + Flask |
| AC Simulation | Python |
| Dashboard | React + Vite |
| Charts | Recharts |
| Icons | Lucide React |
| Container | Docker |
| Version Control | Git + GitHub |


## Trained Model

The trained model is hosted on Hugging Face:
https://huggingface.co/rikasmhd20/Edge-Ai-Smart-Classroom

### Setup
1. Download the model files from the link above.
2. Place them inside the `TrainingData.ONNX/` folder in the project root.
