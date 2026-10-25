import React from 'react';
import { Timer, RotateCcw } from 'lucide-react';

export default function RuntimeCard({ runningTime, onResetTimer }) {
  return (
    <div className="card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
        <span className="metric-label">AC Total Running Time</span>
        <div style={{ background:'#ede9fe', padding:'.5rem', borderRadius:'10px' }}>
          <Timer size={18} color="var(--color-violet)" />
        </div>
      </div>
      <p className="metric-value font-mono" style={{ color:'var(--color-violet)', marginBottom:'.6rem' }}>
        {runningTime || '00:00:00'}
      </p>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <p style={{ fontSize:'.75rem', color:'var(--text-muted)' }}>Accumulated across active sessions</p>
        <button onClick={onResetTimer} className="btn btn-ghost" style={{ padding:'.3rem .65rem', fontSize:'.75rem' }}>
          <RotateCcw size={13} /> Reset
        </button>
      </div>
    </div>
  );
}
