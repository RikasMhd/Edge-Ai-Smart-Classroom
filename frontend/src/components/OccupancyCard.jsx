import React from 'react';
import { Users } from 'lucide-react';

const CONFIG = {
  LOW:    { label:'1–2 Occupants',  badgeClass:'badge-low',    color:'#15803d', bg:'#dcfce7' },
  MEDIUM: { label:'3–9 Occupants',  badgeClass:'badge-medium', color:'#b45309', bg:'#fef3c7' },
  HIGH:   { label:'10+ Occupants',  badgeClass:'badge-high',   color:'#b91c1c', bg:'#fee2e2' },
};

export default function OccupancyCard({ occupancy, count, initialized }) {
  /* Uninitialized — show neutral dash state */
  if (!initialized || !occupancy) {
    return (
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
          <span className="metric-label">Occupancy Level</span>
          <div style={{ background:'#f1f5f9', padding:'.5rem', borderRadius:'10px' }}>
            <Users size={18} color="#94a3b8" />
          </div>
        </div>
        <p className="metric-value" style={{ color:'#94a3b8', marginBottom:'.6rem' }}>—</p>
        <span className="badge badge-off" style={{ fontSize:'.72rem' }}>Awaiting detection</span>
        <p style={{ fontSize:'.75rem', color:'var(--text-muted)', marginTop:'.6rem' }}>No video analyzed yet</p>
      </div>
    );
  }

  const cfg = CONFIG[occupancy] || CONFIG.LOW;
  return (
    <div className="card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
        <span className="metric-label">Occupancy Level</span>
        <div style={{ background:cfg.bg, padding:'.5rem', borderRadius:'10px' }}>
          <Users size={18} color={cfg.color} />
        </div>
      </div>
      <p className="metric-value" style={{ color:cfg.color, marginBottom:'.6rem' }}>{occupancy}</p>
      <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
        <span className={`badge ${cfg.badgeClass}`}>
          {count !== undefined ? `${count} People` : cfg.label}
        </span>
      </div>
      <p style={{ fontSize:'.75rem', color:'var(--text-muted)', marginTop:'.6rem' }}>
        Range: {cfg.label}
      </p>
    </div>
  );
}
