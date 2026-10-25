import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import OccupancyCard from './components/OccupancyCard';
import ACStatusCard from './components/ACStatusCard';
import TemperatureCard from './components/TemperatureCard';
import OccupancyChart from './components/OccupancyChart';
import VideoPlayer from './components/VideoPlayer';
import SimulationControls from './components/SimulationControls';

const API = '';

function fmtRuntime(sec) {
  const s = Math.floor(sec || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function classifyLevel(count, lowMax, medMax) {
  if (count <= lowMax) return 'LOW';
  if (count <= medMax) return 'MEDIUM';
  return 'HIGH';
}

export default function App() {
  const [status, setStatus] = useState({
    occupancy: null,
    person_count: 0,
    ac_state: null,
    temperature: null,
    running_time: '00:00:00',
    timestamp: '',
    model_loaded: false,
  });
  const [history, setHistory] = useState([]);
  const [simLoading, setSimLoading] = useState(false);
  const [videoMode, setVideoMode] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [initialized, setInitialized] = useState(false); // false until first video/simulation

  // Lifted video state so it is never lost across layout changes
  const [phase, setPhase] = useState('idle'); // idle | analyzing | ready
  const [selectedFile, setSelectedFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [currentFrame, setCurrentFrame] = useState(null);

  const videoReady = phase === 'ready';
  const [thresholds, setThresholds] = useState({ lowMax: 2, medMax: 9 });

  /* ── Poll backend (model_loaded only when not initialized) ── */
  const refresh = async () => {
    try {
      const [s, h] = await Promise.all([
        fetch(`${API}/api/status`).then(r => r.json()),
        fetch(`${API}/api/history`).then(r => r.json()),
      ]);
      // Always update model_loaded from backend
      setStatus(prev => ({ ...prev, model_loaded: s.model_loaded }));
      // Only overwrite dashboard values from backend when NOT in video mode
      if (!videoReady && initialized) {
        setStatus(s);
      } else if (!videoReady && !initialized) {
        // Just update model_loaded silently
      }
      setHistory(h.history || []);
    } catch { /* backend not ready */ }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [videoReady, initialized]);

  /* ── Video frame callback ── */
  const handleFrameUpdate = useCallback((frame) => {
    setVideoMode(true);
    setInitialized(true);
    setStatus(prev => ({
      ...prev,
      occupancy: frame.occupancy_level,
      person_count: frame.person_count,
      ac_state: frame.ac_state,
      temperature: frame.temperature,
      running_time: fmtRuntime(frame.cumulative_ac_sec),
      timestamp: `Video @ ${frame.timestamp_label}`,
    }));
  }, []);

  /* ── Video play state ── */
  const handlePlayStateChange = useCallback((playing) => {
    setIsVideoPlaying(playing);
    if (!playing) setVideoMode(false);
  }, []);

  /* ── New Video clicked — reset cards to dash ── */
  const handleVideoReset = useCallback(() => {
    setInitialized(false);
    setVideoMode(false);
    setPhase('idle');
    setAnalysisData(null);
    setCurrentFrame(null);
    setSelectedFile(null);
    if (videoUrl) {
      try { URL.revokeObjectURL(videoUrl); } catch { /* ignore */ }
    }
    setVideoUrl(null);
    setStatus(prev => ({
      ...prev,
      occupancy: null,
      person_count: 0,
      ac_state: null,
      temperature: null,
      running_time: '00:00:00',
      timestamp: '',
    }));
  }, [videoUrl]);

  /* ── Manual simulation ── */
  const handleSimulate = async (levelKey, personCount) => {
    setSimLoading(true);
    setVideoMode(false);
    try {
      const correctedLevel = classifyLevel(personCount, thresholds.lowMax, thresholds.medMax);
      const r = await fetch(`${API}/api/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ occupancy: correctedLevel, person_count: personCount }),
      });
      const d = await r.json();
      setStatus(d.status);
      setInitialized(true);
      refresh();
    } catch (e) { console.error(e); }
    finally { setSimLoading(false); }
  };

  /* ── Threshold change — reclassify on the fly ── */
  const handleThresholdChange = (newT) => {
    setThresholds(newT);

    if (!videoMode && initialized && status.person_count !== undefined) {
      const newLevel = classifyLevel(status.person_count, newT.lowMax, newT.medMax);
      const acState = newLevel === 'LOW' ? 'OFF' : 'ON';
      const temp = newLevel === 'HIGH' ? 20 : newLevel === 'MEDIUM' ? 24 : null;
      setStatus(prev => ({ ...prev, occupancy: newLevel, ac_state: acState, temperature: temp }));
    }
  };

  /* ── Shared card elements ── */
  const metricCards = (
    <>
      <OccupancyCard
        occupancy={status.occupancy}
        count={status.person_count}
        initialized={initialized}
      />
      <ACStatusCard
        acState={status.ac_state}
        initialized={initialized}
      />
      <TemperatureCard
        temperature={status.temperature}
        acState={status.ac_state}
        initialized={initialized}
      />
    </>
  );

  return (
    <div className="dashboard-container">
      <Header statusData={status} />

      {/* ── Top metrics: shown when NOT in video playback mode ── */}
      {!videoReady && (
        <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
          {metricCards}
        </div>
      )}

      {/* ── Video Player & Live Metrics: stable hierarchy prevents remounting ── */}
      <div className={videoReady ? "video-dashboard-layout" : ""}>
        <div className={videoReady ? "video-dashboard-main" : ""}>
          <VideoPlayer
            phase={phase}
            setPhase={setPhase}
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            videoUrl={videoUrl}
            setVideoUrl={setVideoUrl}
            analysisData={analysisData}
            setAnalysisData={setAnalysisData}
            currentFrame={currentFrame}
            setCurrentFrame={setCurrentFrame}
            onFrameUpdate={handleFrameUpdate}
            onPlayStateChange={handlePlayStateChange}
            onVideoReset={handleVideoReset}
            thresholds={thresholds}
          />
        </div>

        {videoReady && (
          <div className="video-dashboard-sidebar">
            <div className="sidebar-header">
              <span className="pulse-dot pulse-blue"></span>
              <span>Live Metrics</span>
            </div>
            {metricCards}
          </div>
        )}
      </div>

      {/* ── Manual simulation (blurred during playback) ── */}
      <SimulationControls
        onSimulate={handleSimulate}
        currentLevel={status.occupancy}
        loading={simLoading}
        thresholds={thresholds}
        onThresholdChange={handleThresholdChange}
        isVideoPlaying={isVideoPlaying}
      />

      {/* ── Event timeline chart ── */}
      <OccupancyChart history={history} />

      <footer style={{ textAlign: 'center', padding: '1.5rem 0', fontSize: '.78rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', marginTop: '.5rem' }}>
        Smart Classroom Edge AI System &nbsp;·&nbsp; ONNX Runtime · Python Flask · React
        <br />
        <span className="font-mono" style={{ fontSize: '.72rem' }}>{status.timestamp}</span>
      </footer>
    </div>
  );
}

