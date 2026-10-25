import React from 'react';
import { Fan, Power } from 'lucide-react';

export default function ACStatusCard({ acState, initialized }) {
  /* Uninitialized — show neutral dash state */
  if (!initialized || !acState) {
    return (
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
          <span className="metric-label">AC System State</span>
          <div style={{ background:'#f1f5f9', padding:'.5rem', borderRadius:'10px' }}>
            <Fan size={18} color="#94a3b8" />
          </div>
        </div>
        <p className="metric-value" style={{ color:'#94a3b8', marginBottom:'.6rem' }}>—</p>
        <span className="badge badge-off" style={{ fontSize:'.72rem' }}>Awaiting detection</span>
        <p style={{ fontSize:'.75rem', color:'var(--text-muted)', marginTop:'.6rem' }}>No video analyzed yet</p>
      </div>
    );
  }

  const isOn = acState === 'ON';
  return (
    <div className="card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
        <span className="metric-label">AC System State</span>
        <div style={{ background: isOn ? '#dbeafe' : '#f1f5f9', padding:'.5rem', borderRadius:'10px' }}>
          <Fan size={18} className={isOn ? 'spin-fan' : ''} color={isOn ? 'var(--color-blue)' : 'var(--text-muted)'} />
        </div>
      </div>
      <p className="metric-value" style={{ color: isOn ? 'var(--color-blue)' : 'var(--text-muted)', marginBottom:'.6rem' }}>
        {acState}
      </p>
      <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
        <span className={`badge ${isOn ? 'badge-on' : 'badge-off'}`}>
          <Power size={11} />
          {isOn ? 'Active Cooling' : 'Standby'}
        </span>
      </div>
      <p style={{ fontSize:'.75rem', color:'var(--text-muted)', marginTop:'.6rem' }}>
        {isOn ? 'HVAC Compressors Running' : 'Compressor Power Off'}
      </p>
    </div>
  );
}
