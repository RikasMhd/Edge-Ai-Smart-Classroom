import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload, Video, Cpu, Play, Pause, RotateCcw,
  ChevronDown, ChevronUp, Clock, AlertCircle,
} from 'lucide-react';

/* Classify person count using custom thresholds */
function classifyLevel(personCount, lowMax, medMax) {
  if (personCount <= lowMax) return 'LOW';
  if (personCount <= medMax) return 'MEDIUM';
  return 'HIGH';
}

function acFromLevel(level) {
  if (level === 'MEDIUM') return { ac_state: 'ON', temperature: 24 };
  if (level === 'HIGH') return { ac_state: 'ON', temperature: 20 };
  return { ac_state: 'OFF', temperature: null };
}

/* ─── constants ───────────────────────────────────────────────── */
const LEVEL_COLOR = { LOW: '#15803d', MEDIUM: '#b45309', HIGH: '#b91c1c' };
const LEVEL_BG = { LOW: 'rgba(220,252,231,0.92)', MEDIUM: 'rgba(254,243,199,0.92)', HIGH: 'rgba(254,226,226,0.92)' };
const LEVEL_BORDER = { LOW: '#86efac', MEDIUM: '#fcd34d', HIGH: '#fca5a5' };
const LEVEL_BAR = { LOW: '#22c55e', MEDIUM: '#f59e0b', HIGH: '#ef4444' };

function fmtTime(sec) {
  const s = Math.floor(sec || 0);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function fmtRuntime(sec) {
  const s = Math.floor(sec || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
function findFrame(frames, currentSec) {
  if (!frames?.length) return null;
  return frames.reduce((best, f) =>
    Math.abs(f.timestamp_sec - currentSec) < Math.abs(best.timestamp_sec - currentSec) ? f : best
    , frames[0]);
}

/* ─── Canvas bounding-box overlay ─────────────────────────────── */
function drawBoxes(canvas, video, predictions) {
  if (!canvas || !video) return;
  // Match canvas pixels to the video element's rendered size
  canvas.width = video.clientWidth;
  canvas.height = video.clientHeight;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!predictions?.length) return;

  const W = canvas.width;
  const H = canvas.height;

  // Compute letterbox offsets (video uses object-fit: contain)
  const vAspect = (video.videoWidth || W) / (video.videoHeight || H);
  const cAspect = W / H;
  let drawW = W, drawH = H, offX = 0, offY = 0;
  if (vAspect > cAspect) {
    drawH = W / vAspect; offY = (H - drawH) / 2;
  } else {
    drawW = H * vAspect; offX = (W - drawW) / 2;
  }

  for (const pred of predictions) {
    const b = pred.boundingBox;
    const x = offX + b.left * drawW;
    const y = offY + b.top * drawH;
    const w = b.width * drawW;
    const h = b.height * drawH;

    // Box
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, w, h);

    // Label background
    const label = `Person  ${Math.round(pred.probability * 100)}%`;
    ctx.font = `bold 12px Outfit, sans-serif`;
    const tw = ctx.measureText(label).width + 10;
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(x, Math.max(0, y - 22), tw, 22);

    // Label text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + 5, Math.max(13, y - 6));
  }
}

/* ─── History row ─────────────────────────────────────────────── */
function HistoryRow({ record, onLoad }) {
  const lvl = record.overall_level;
  return (
    <div
      onClick={() => onLoad(record)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '.6rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border-color)',
        transition: 'background .15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', minWidth: 0 }}>
        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: LEVEL_BAR[lvl], flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: '.83rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '260px' }}>
            {record.filename}
          </p>
          <p style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: '1px' }}>
            {record.analyzedAt} &nbsp;·&nbsp; {fmtTime(record.duration)} &nbsp;·&nbsp; {record.frames} frames
          </p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexShrink: 0 }}>
        <span style={{
          fontSize: '.72rem', fontWeight: 700, padding: '.2rem .55rem', borderRadius: '9999px',
          background: lvl === 'LOW' ? '#dcfce7' : lvl === 'MEDIUM' ? '#fef3c7' : '#fee2e2',
          color: LEVEL_COLOR[lvl]
        }}>
          {lvl}
        </span>
        <span style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>AC {fmtRuntime(record.total_ac_sec)}</span>
      </div>
    </div>
  );
}

/* ─── Main VideoPlayer ─────────────────────────────────────────── */
export default function VideoPlayer({
  phase: extPhase,
  setPhase: extSetPhase,
  selectedFile: extSelectedFile,
  setSelectedFile: extSetSelectedFile,
  videoUrl: extVideoUrl,
  setVideoUrl: extSetVideoUrl,
  analysisData: extAnalysisData,
  setAnalysisData: extSetAnalysisData,
  currentFrame: extCurrentFrame,
  setCurrentFrame: extSetCurrentFrame,
  onFrameUpdate,
  onPlayStateChange,
  onVideoReset,
  thresholds,
}) {
  const lowMax = thresholds?.lowMax ?? 2;
  const medMax = thresholds?.medMax ?? 9;

  const [localPhase, setLocalPhase] = useState('idle');
  const phase = extPhase !== undefined ? extPhase : localPhase;
  const setPhase = extSetPhase || setLocalPhase;

  const [localFile, setLocalFile] = useState(null);
  const selectedFile = extSelectedFile !== undefined ? extSelectedFile : localFile;
  const setSelectedFile = extSetSelectedFile || setLocalFile;

  const [localUrl, setLocalUrl] = useState(null);
  const videoUrl = extVideoUrl !== undefined ? extVideoUrl : localUrl;
  const setVideoUrl = extSetVideoUrl || setLocalUrl;

  const [localAnalysis, setLocalAnalysis] = useState(null);
  const analysisData = extAnalysisData !== undefined ? extAnalysisData : localAnalysis;
  const setAnalysisData = extSetAnalysisData || setLocalAnalysis;

  const [localFrame, setLocalFrame] = useState(null);
  const currentFrame = extCurrentFrame !== undefined ? extCurrentFrame : localFrame;
  const setCurrentFrame = extSetCurrentFrame || setLocalFrame;

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const [analyzeMsg, setAnalyzeMsg] = useState('');
  const [history, setHistory] = useState([]);       // previous video analyses
  const [historyOpen, setHistoryOpen] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);

  /* Draw boxes whenever the current frame changes */
  useEffect(() => {
    if (phase === 'ready' && currentFrame) {
      drawBoxes(canvasRef.current, videoRef.current, currentFrame.predictions);
    }
  }, [currentFrame, phase]);

  /* ── File selection ── */
  const handleFile = (file) => {
    if (!file) return;
    if (!/\.(mp4|avi|mov|webm|mkv)$/i.test(file.name)) {
      setError('Please upload a video file (.mp4 .avi .mov .webm .mkv)');
      return;
    }
    setError(null);
    setSelectedFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setAnalysisData(null);
    setCurrentFrame(null);
    setPhase('idle');
    setIsPlaying(false);
    setProgress(0);
  };

  /* ── Analyze ── */
  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setPhase('analyzing');
    setError(null);
    setAnalyzeMsg('Uploading video & running Edge AI inference...');

    const form = new FormData();
    form.append('file', selectedFile);
    try {
      const res = await fetch('/api/analyze_video', {
        method: 'POST', body: form
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Error ${res.status}`);
      const raw = await res.json();
      // Re-classify each frame with current custom thresholds
      const data = {
        ...raw,
        frame_results: raw.frame_results.map(f => {
          const level = classifyLevel(f.person_count, lowMax, medMax);
          const ac = acFromLevel(level);
          return { ...f, occupancy_level: level, ac_state: ac.ac_state, temperature: ac.temperature };
        }),
      };
      // Recompute cumulative AC time with reclassified frames
      let cumAc = 0, prevTs = 0, prevOn = false;
      data.frame_results = data.frame_results.map((f, i) => {
        if (prevOn && i > 0) cumAc += f.timestamp_sec - prevTs;
        prevOn = f.ac_state === 'ON';
        prevTs = f.timestamp_sec;
        return { ...f, cumulative_ac_sec: Math.round(cumAc * 10) / 10 };
      });
      // Recompute overall level (majority)
      const counts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
      data.frame_results.forEach(f => counts[f.occupancy_level]++);
      data.overall_level = Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b);
      data.total_ac_sec = data.frame_results.at(-1)?.cumulative_ac_sec ?? 0;

      setAnalysisData(data);
      setPhase('ready');

      // Record in local history
      const record = {
        id: Date.now(),
        filename: data.video_filename,
        duration: data.duration_sec,
        frames: data.frames_analyzed,
        overall_level: data.overall_level,
        total_ac_sec: data.total_ac_sec,
        analyzedAt: new Date().toLocaleTimeString(),
        data,
        fileUrl: videoUrl,
      };
      setHistory(prev => [record, ...prev].slice(0, 10));

      const first = data.frame_results?.[0];
      if (first) { setCurrentFrame(first); onFrameUpdate?.(first); }
    } catch (err) {
      const msg = err.message === 'Failed to fetch' || err.name === 'TypeError'
        ? 'Cannot connect to backend server. Please verify the Flask backend is running (python backend/app.py).'
        : err.message;
      setError(msg);
      setPhase('idle');
    }
  };

  /* ── Time update → sync frame + canvas ── */
  const handleTimeUpdate = useCallback(() => {
    const vid = videoRef.current;
    if (!vid || !analysisData?.frame_results) return;
    const cur = vid.currentTime;
    const dur = vid.duration || analysisData.duration_sec || 1;
    setProgress((cur / dur) * 100);

    const frame = findFrame(analysisData.frame_results, cur);
    if (frame && frame.timestamp_sec !== currentFrame?.timestamp_sec) {
      setCurrentFrame(frame);
      onFrameUpdate?.(frame);
    }
    // Always redraw boxes to keep canvas in sync even during seek
    drawBoxes(canvasRef.current, vid, frame?.predictions);
  }, [analysisData, currentFrame, onFrameUpdate]);

  /* Also redraw on resize */
  useEffect(() => {
    const onResize = () => drawBoxes(canvasRef.current, videoRef.current, currentFrame?.predictions);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [currentFrame]);

  /* ── Controls ── */
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  };
  const handleRestart = () => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.play();
  };

  /* Notify parent of play state changes */
  const handlePlay = () => { setIsPlaying(true); onPlayStateChange?.(true); };
  const handlePause = () => { setIsPlaying(false); onPlayStateChange?.(false); };
  const handleEnded = () => { setIsPlaying(false); onPlayStateChange?.(false); };

  /* ── Timeline click ── */
  const handleTimelineClick = (e) => {
    if (!analysisData) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const vid = videoRef.current;
    if (vid?.duration) vid.currentTime = frac * vid.duration;
  };

  /* ── Load history item ── */
  const handleLoadHistory = (record) => {
    setHistoryOpen(false);
    setSelectedFile(null);
    setVideoUrl(record.fileUrl);
    setAnalysisData(record.data);
    setPhase('ready');
    setCurrentFrame(record.data.frame_results?.[0] || null);
    setProgress(0);
    if (videoRef.current) videoRef.current.currentTime = 0;
    onFrameUpdate?.(record.data.frame_results?.[0]);
  };

  const dur = analysisData?.duration_sec || 0;
  const lvl = currentFrame?.occupancy_level || 'LOW';
  const pCount = currentFrame?.person_count || 0;
  const acS = currentFrame?.ac_state || 'OFF';
  const temp = currentFrame?.temperature;
  const acRuntime = currentFrame?.cumulative_ac_sec || 0;

  /* ═══════════════════════════════════════════════════════════ */
  /* PHASE: idle / analyzing — upload UI                         */
  /* ═══════════════════════════════════════════════════════════ */
  if (phase !== 'ready') return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', marginBottom: '1.25rem' }}>
        <div style={{ background: '#eff6ff', padding: '.5rem', borderRadius: '10px' }}>
          <Video size={18} color="var(--color-blue)" />
        </div>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Video Occupancy Analysis</h3>
          <p style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
            Upload a classroom video — AI analyzes each frame and plays back with live occupancy &amp; AC updates
          </p>
        </div>
      </div>

      <div
        className={`drop-zone${dragOver ? ' dragover' : ''}`}
        style={{ maxWidth: '520px', margin: '0 auto 1rem' }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file"
          accept="video/mp4,video/avi,video/quicktime,video/webm,.mp4,.avi,.mov,.webm,.mkv"
          style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
        <Upload size={34} color="var(--color-blue)" style={{ margin: '0 auto .75rem', display: 'block' }} />
        {selectedFile
          ? <><p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '.95rem' }}>{selectedFile.name}</p>
            <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: '.25rem' }}>{(selectedFile.size / 1024 / 1024).toFixed(1)} MB — click to change</p></>
          : <><p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Click or drag to upload a classroom video</p>
            <p style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: '.3rem' }}>MP4 · AVI · MOV · WebM</p></>
        }
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={handleAnalyze}
          disabled={!selectedFile || phase === 'analyzing'}
          style={{ minWidth: '260px', padding: '.75rem 1.5rem', fontSize: '.95rem' }}>
          {phase === 'analyzing'
            ? <><Cpu size={18} className="spin-fan" /> {analyzeMsg || 'Analyzing...'}</>
            : <><Cpu size={18} /> Analyze Video with Edge AI</>}
        </button>
      </div>

      {error && (
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'flex-start', padding: '.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', fontSize: '.83rem', color: '#b91c1c', marginTop: '1rem', maxWidth: '520px', margin: '1rem auto 0' }}>
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '1px' }} />{error}
        </div>
      )}

      {/* History dropdown even on idle */}
      {history.length > 0 && (
        <div style={{ maxWidth: '520px', margin: '1.25rem auto 0' }}>
          <HistoryDropdown history={history} open={historyOpen}
            onToggle={() => setHistoryOpen(o => !o)} onLoad={handleLoadHistory} />
        </div>
      )}
    </div>
  );

  /* ═══════════════════════════════════════════════════════════ */
  /* PHASE: ready — video player                                  */
  /* ═══════════════════════════════════════════════════════════ */
  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          <div style={{ background: '#eff6ff', padding: '.5rem', borderRadius: '10px' }}>
            <Video size={18} color="var(--color-blue)" />
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Live Video Playback — AI Sync</h3>
            <p style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
              {analysisData.video_filename} &nbsp;·&nbsp; {fmtTime(dur)} &nbsp;·&nbsp; {analysisData.frames_analyzed} frames analyzed
            </p>
          </div>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: '.8rem', padding: '.35rem .75rem' }}
          onClick={() => {
            setPhase('idle');
            setProgress(0);
            setCurrentFrame(null);
            setIsPlaying(false);
            videoRef.current?.pause();
            onPlayStateChange?.(false);
            onVideoReset?.();
          }}>
          <Upload size={14} /> New Video
        </button>
      </div>

      {/* ── Video + Canvas overlay ──────────────────────────── */}
      <div style={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', background: '#0f172a', boxShadow: 'var(--shadow-md)', marginBottom: '.85rem' }}>
        <video
          ref={videoRef}
          src={videoUrl}
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          style={{ width: '100%', display: 'block', maxHeight: '420px', objectFit: 'contain' }}
        />
        {/* Canvas sits exactly over the video for bounding boxes */}
        <canvas ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        />

        {/* TOP-LEFT: Occupancy + person count badge */}
        <div style={{
          position: 'absolute', top: '12px', left: '12px',
          background: LEVEL_BG[lvl],
          border: `1.5px solid ${LEVEL_BORDER[lvl]}`,
          borderRadius: '10px', padding: '.35rem .85rem',
          display: 'flex', alignItems: 'center', gap: '.5rem',
          backdropFilter: 'blur(4px)',
        }}>
          <span style={{ fontSize: '.85rem', fontWeight: 800, color: LEVEL_COLOR[lvl], letterSpacing: '-.01em' }}>
            {lvl}
          </span>
          <span style={{ width: '1px', height: '14px', background: LEVEL_BORDER[lvl] }} />
          <span style={{ fontSize: '.82rem', fontWeight: 600, color: LEVEL_COLOR[lvl] }}>
            {pCount} {pCount === 1 ? 'person' : 'people'}
          </span>
        </div>

        {/* TOP-RIGHT: AC state badge */}
        <div style={{
          position: 'absolute', top: '12px', right: '12px',
          background: acS === 'ON' ? 'rgba(219,234,254,0.92)' : 'rgba(241,245,249,0.92)',
          border: `1.5px solid ${acS === 'ON' ? '#93c5fd' : '#e2e8f0'}`,
          borderRadius: '10px', padding: '.35rem .85rem',
          backdropFilter: 'blur(4px)',
        }}>
          <span style={{ fontSize: '.82rem', fontWeight: 700, color: acS === 'ON' ? '#1d4ed8' : '#64748b' }}>
            AC {acS}{temp ? ` · ${temp}°C` : ''}
          </span>
        </div>

        {/* BOTTOM-LEFT: AC runtime */}
        <div style={{
          position: 'absolute', bottom: '12px', left: '12px',
          background: 'rgba(237,233,254,0.92)',
          border: '1.5px solid #c4b5fd',
          borderRadius: '10px', padding: '.3rem .75rem',
          backdropFilter: 'blur(4px)',
        }}>
          <span className="font-mono" style={{ fontSize: '.8rem', fontWeight: 600, color: '#7c3aed' }}>
            AC Runtime: {fmtRuntime(acRuntime)}
          </span>
        </div>

        {/* BOTTOM-RIGHT: current timestamp */}
        <div style={{
          position: 'absolute', bottom: '12px', right: '12px',
          background: 'rgba(15,23,42,0.7)',
          borderRadius: '8px', padding: '.28rem .7rem',
          backdropFilter: 'blur(4px)',
        }}>
          <span className="font-mono" style={{ fontSize: '.78rem', color: '#e2e8f0' }}>
            {currentFrame ? fmtTime(currentFrame.timestamp_sec) : '00:00'} / {fmtTime(dur)}
          </span>
        </div>
      </div>

      {/* ── Controls ─────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', marginBottom: '.85rem', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={togglePlay} style={{ padding: '.5rem 1.1rem' }}>
          {isPlaying ? <><Pause size={16} /> Pause</> : <><Play size={16} /> Play</>}
        </button>
        <button className="btn btn-ghost" onClick={handleRestart} style={{ padding: '.5rem 1rem' }}>
          <RotateCcw size={15} /> Restart
        </button>

        {/* Compact live stats beside buttons */}
        <div style={{ display: 'flex', gap: '.5rem', marginLeft: 'auto', flexWrap: 'wrap' }}>
          {[
            { label: 'Occupancy', value: lvl, color: LEVEL_COLOR[lvl], bg: LEVEL_BG[lvl] },
            { label: 'AC', value: `${acS}${temp ? ` ${temp}°C` : ''}`, color: acS === 'ON' ? '#1d4ed8' : '#64748b', bg: acS === 'ON' ? 'rgba(219,234,254,0.7)' : 'rgba(241,245,249,0.7)' },
            { label: 'People', value: pCount, color: '#374151', bg: 'rgba(249,250,251,0.9)' },
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: '8px', padding: '.28rem .65rem', border: '1px solid rgba(0,0,0,.08)' }}>
              <span style={{ fontSize: '.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>{s.label}: </span>
              <span style={{ fontSize: '.82rem', fontWeight: 700, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Color-coded timeline scrubber ─────────────────────── */}
      <div style={{ marginBottom: '1rem' }}>
        <p style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginBottom: '.35rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Occupancy Timeline — click to seek
        </p>
        <div onClick={handleTimelineClick}
          style={{ position: 'relative', height: '30px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', background: '#f1f5f9', border: '1px solid var(--border-color)' }}>
          {analysisData.frame_results.map((f, i) => {
            const startPct = (f.timestamp_sec / dur) * 100;
            const endTs = analysisData.frame_results[i + 1]?.timestamp_sec ?? dur;
            const widthPct = ((endTs - f.timestamp_sec) / dur) * 100;
            return (
              <div key={i}
                title={`${f.timestamp_label} — ${f.occupancy_level} (${f.person_count} people) · AC ${f.ac_state}${f.temperature ? ` @ ${f.temperature}°C` : ''}`}
                style={{
                  position: 'absolute', left: `${startPct}%`, width: `${widthPct}%`, height: '100%',
                  background: LEVEL_BAR[f.occupancy_level], opacity: .72
                }}
              />
            );
          })}
          {/* Playhead */}
          <div style={{
            position: 'absolute', left: `${progress}%`, top: 0, bottom: 0, width: '3px',
            background: '#0f172a', transform: 'translateX(-1px)', boxShadow: '0 0 5px rgba(0,0,0,.4)', transition: 'left .12s linear'
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '.2rem', fontSize: '.68rem', color: 'var(--text-muted)' }}>
          <span>00:00</span><span>{fmtTime(dur / 2)}</span><span>{fmtTime(dur)}</span>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: '1rem', marginTop: '.4rem' }}>
          {[['LOW', '#22c55e'], ['MEDIUM', '#f59e0b'], ['HIGH', '#ef4444']].map(([l, c]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '.3rem', fontSize: '.72rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: c, display: 'inline-block' }} />
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{l}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Previous videos history dropdown ─────────────────── */}
      <HistoryDropdown
        history={history}
        open={historyOpen}
        onToggle={() => setHistoryOpen(o => !o)}
        onLoad={handleLoadHistory}
      />
    </div>
  );
}

/* ── History dropdown sub-component ───────────────────────────── */
function HistoryDropdown({ history, open, onToggle, onLoad }) {
  if (!history.length) return null;
  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden', marginTop: '.25rem' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '.7rem 1rem', background: 'var(--bg-card-2)', border: 'none', cursor: 'pointer',
          fontSize: '.85rem', fontWeight: 600, color: 'var(--text-primary)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <Clock size={15} color="var(--color-blue)" />
          Previous Video Analyses ({history.length})
        </span>
        {open ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
      </button>

      {open && (
        <div style={{ background: '#fff', maxHeight: '260px', overflowY: 'auto' }}>
          {history.map(r => (
            <HistoryRow key={r.id} record={r} onLoad={onLoad} />
          ))}
        </div>
      )}
    </div>
  );
}
