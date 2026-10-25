import React, { useState } from 'react';
import { Sliders, Settings2, VideoOff } from 'lucide-react';

const STYLE = {
  LOW:    { badgeClass:'badge-low',    btnBg:'#dcfce7', btnColor:'#15803d', btnBorder:'#86efac', acText:'AC OFF'       },
  MEDIUM: { badgeClass:'badge-medium', btnBg:'#fef3c7', btnColor:'#b45309', btnBorder:'#fde68a', acText:'AC ON @ 24°C' },
  HIGH:   { badgeClass:'badge-high',   btnBg:'#fee2e2', btnColor:'#b91c1c', btnBorder:'#fca5a5', acText:'AC ON @ 20°C' },
};

/* Build human-readable range labels from thresholds */
function rangeLabel(key, lowMax, medMax) {
  if (key === 'LOW')    return `1 – ${lowMax} ${lowMax === 1 ? 'person' : 'people'}`;
  if (key === 'MEDIUM') return `${lowMax + 1} – ${medMax} people`;
  return `${medMax + 1}+ people`;
}

/* Pick a representative count for each level */
function repCount(key, lowMax, medMax) {
  if (key === 'LOW')    return Math.max(1, Math.floor(lowMax / 2) || 1);
  if (key === 'MEDIUM') return lowMax + 1;
  return medMax + 1;
}

export default function SimulationControls({
  onSimulate,
  currentLevel,
  loading,
  thresholds,        // { lowMax, medMax }
  onThresholdChange, // (newThresholds) => void
  isVideoPlaying,    // bool — blur when true
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { lowMax, medMax } = thresholds;

  const handleLowMax = (v) => {
    const n = Math.max(1, Math.min(medMax - 1, parseInt(v) || 1));
    onThresholdChange({ lowMax: n, medMax });
  };
  const handleMedMax = (v) => {
    const n = Math.max(lowMax + 1, parseInt(v) || lowMax + 1);
    onThresholdChange({ lowMax, medMax: n });
  };

  return (
    /* Outer wrapper — relative so overlay can sit on top */
    <div style={{ position:'relative', marginBottom:'1.5rem' }}>
      <div className="card">

        {/* Header row */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'.6rem' }}>
            <Sliders size={17} color="var(--color-amber)" />
            <div>
              <h3 style={{ fontSize:'1rem', fontWeight:600, color:'var(--text-primary)' }}>Manual Simulation</h3>
              <p style={{ fontSize:'.78rem', color:'var(--text-muted)' }}>
                Manually trigger an occupancy level to test AC logic
              </p>
            </div>
          </div>
          {/* Threshold settings toggle */}
          <button
            onClick={() => setSettingsOpen(o => !o)}
            className="btn btn-ghost"
            style={{ padding:'.35rem .75rem', fontSize:'.78rem', gap:'.35rem' }}
            title="Configure LOW / MEDIUM / HIGH thresholds"
          >
            <Settings2 size={14} />
            Thresholds
          </button>
        </div>

        {/* ── Threshold editor (collapsible) ── */}
        {settingsOpen && (
          <div style={{
            background:'#f8fafc', border:'1px solid var(--border-color)',
            borderRadius:'12px', padding:'1rem', marginBottom:'1rem',
            display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'1rem'
          }}>
            {/* LOW max */}
            <div>
              <label style={{ fontSize:'.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', color:'#15803d', display:'block', marginBottom:'.35rem' }}>
                LOW — up to
              </label>
              <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                <input
                  type="number" min={1} max={medMax - 1} value={lowMax}
                  onChange={e => handleLowMax(e.target.value)}
                  style={{ width:'70px', padding:'.4rem .6rem', border:'1.5px solid #86efac', borderRadius:'8px', fontSize:'.9rem', fontWeight:700, color:'#15803d', background:'#dcfce7', outline:'none', textAlign:'center' }}
                />
                <span style={{ fontSize:'.82rem', color:'var(--text-muted)' }}>people → <strong>LOW</strong></span>
              </div>
              <p style={{ fontSize:'.7rem', color:'var(--text-muted)', marginTop:'.3rem' }}>Range: 1 – {lowMax}</p>
            </div>

            {/* MEDIUM max */}
            <div>
              <label style={{ fontSize:'.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', color:'#b45309', display:'block', marginBottom:'.35rem' }}>
                MEDIUM — up to
              </label>
              <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                <input
                  type="number" min={lowMax + 1} value={medMax}
                  onChange={e => handleMedMax(e.target.value)}
                  style={{ width:'70px', padding:'.4rem .6rem', border:'1.5px solid #fde68a', borderRadius:'8px', fontSize:'.9rem', fontWeight:700, color:'#b45309', background:'#fef3c7', outline:'none', textAlign:'center' }}
                />
                <span style={{ fontSize:'.82rem', color:'var(--text-muted)' }}>people → <strong>MEDIUM</strong></span>
              </div>
              <p style={{ fontSize:'.7rem', color:'var(--text-muted)', marginTop:'.3rem' }}>Range: {lowMax + 1} – {medMax}</p>
            </div>

            {/* HIGH (auto) */}
            <div>
              <label style={{ fontSize:'.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.05em', color:'#b91c1c', display:'block', marginBottom:'.35rem' }}>
                HIGH — automatic
              </label>
              <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                <div style={{ width:'70px', padding:'.4rem .6rem', border:'1.5px solid #fca5a5', borderRadius:'8px', fontSize:'.9rem', fontWeight:700, color:'#b91c1c', background:'#fee2e2', textAlign:'center' }}>
                  {medMax + 1}+
                </div>
                <span style={{ fontSize:'.82rem', color:'var(--text-muted)' }}>people → <strong>HIGH</strong></span>
              </div>
              <p style={{ fontSize:'.7rem', color:'var(--text-muted)', marginTop:'.3rem' }}>Range: {medMax + 1}+ (auto)</p>
            </div>
          </div>
        )}

        {/* ── Level buttons ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'1rem' }}>
          {['LOW', 'MEDIUM', 'HIGH'].map(key => {
            const s        = STYLE[key];
            const isActive = currentLevel === key;
            const label    = rangeLabel(key, lowMax, medMax);
            const count    = repCount(key, lowMax, medMax);
            return (
              <button
                key={key}
                disabled={loading}
                onClick={() => onSimulate(key, count)}
                style={{
                  display:'flex', flexDirection:'column', alignItems:'flex-start', gap:'.35rem',
                  padding:'.9rem 1.1rem',
                  border:`2px solid ${isActive ? s.btnBorder : 'var(--border-color)'}`,
                  borderRadius:'12px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: isActive ? s.btnBg : 'var(--bg-card-2)',
                  opacity: loading ? .5 : 1,
                  transition:'all .18s ease',
                  textAlign:'left',
                }}
              >
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%' }}>
                  <span style={{ fontWeight:700, fontSize:'.95rem', color: isActive ? s.btnColor : 'var(--text-primary)' }}>
                    {key}
                  </span>
                  <span className={`badge ${s.badgeClass}`} style={{ fontSize:'.68rem' }}>{label}</span>
                </div>
                <span style={{ fontSize:'.78rem', color:'var(--text-secondary)' }}>
                  Expected: {s.acText}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Blur overlay when video is playing ── */}
      {isVideoPlaying && (
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '16px',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
          background: 'rgba(255,255,255,0.55)',
          pointerEvents: 'all',  /* blocks all clicks */
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '.5rem',
          zIndex: 10,
        }}>
          <VideoOff size={28} color="#64748b" />
          <p style={{ fontSize:'.88rem', fontWeight:600, color:'#475569' }}>
            Video is playing — simulation locked
          </p>
          <p style={{ fontSize:'.76rem', color:'#94a3b8' }}>Pause or stop the video to manually simulate</p>
        </div>
      )}
    </div>
  );
}
