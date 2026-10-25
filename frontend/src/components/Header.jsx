import React from 'react';
import { Cpu, Shield } from 'lucide-react';

export default function Header({ statusData }) {
  const modelLoaded = statusData?.model_loaded ?? false;

  return (
    <header className="card" style={{ marginBottom:'1.5rem', display:'flex', flexWrap:'wrap', justifyContent:'space-between', alignItems:'center', gap:'1rem', padding:'1.25rem 1.5rem' }}>
      {/* Brand */}
      <div style={{ display:'flex', alignItems:'center', gap:'.875rem' }}>
        <div style={{ background:'linear-gradient(135deg,#2563eb,#4f46e5)', padding:'.65rem', borderRadius:'12px', display:'flex', boxShadow:'0 4px 12px rgba(37,99,235,.3)' }}>
          <Cpu size={22} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize:'1.3rem', fontWeight:700, color:'var(--text-primary)', letterSpacing:'-.02em' }}>
            Smart Classroom Edge AI System
          </h1>
          <p style={{ fontSize:'.8rem', color:'var(--text-muted)', marginTop:'2px' }}>
            Video-based Occupancy Detection · Automated Climate Control
          </p>
        </div>
      </div>

      {/* Status chips */}
      <div style={{ display:'flex', alignItems:'center', gap:'.75rem', flexWrap:'wrap' }}>
        <span className={`badge ${modelLoaded ? 'badge-on' : 'badge-off'}`} style={{ gap:'.45rem' }}>
          <span className={`pulse-dot ${modelLoaded ? 'pulse-blue' : 'pulse-rose'}`}></span>
          {modelLoaded ? 'EDGE SYSTEM ONLINE' : 'BACKEND OFFLINE'}
        </span>

        <span style={{ display:'flex', alignItems:'center', gap:'.4rem', fontSize:'.8rem', color: modelLoaded ? 'var(--color-emerald)' : 'var(--color-rose)', background: modelLoaded ? '#dcfce7' : '#fee2e2', padding:'.35rem .8rem', borderRadius:'9999px', border:`1.5px solid ${modelLoaded ? '#bbf7d0' : '#fecaca'}`, fontWeight:600 }}>
          <Shield size={14} />
          ONNX: {modelLoaded ? 'ACTIVE' : 'OFFLINE'}
        </span>
      </div>
    </header>
  );
}
