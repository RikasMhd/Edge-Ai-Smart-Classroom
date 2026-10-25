import React from 'react';
import { Thermometer, Snowflake } from 'lucide-react';

export default function TemperatureCard({ temperature, acState, initialized }) {
  /* Uninitialized — show dash */
  if (!initialized || !acState) {
    return (
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
          <span className="metric-label">Target Temperature</span>
          <div style={{ background:'#f1f5f9', padding:'.5rem', borderRadius:'10px' }}>
            <Thermometer size={18} color="#94a3b8" />
          </div>
        </div>
        <p className="metric-value" style={{ color:'#94a3b8', marginBottom:'.6rem' }}>—</p>
        <span className="badge badge-off" style={{ fontSize:'.72rem' }}>Awaiting detection</span>
        <p style={{ fontSize:'.75rem', color:'var(--text-muted)', marginTop:'.6rem' }}>No video analyzed yet</p>
      </div>
    );
  }

  const isOn  = acState === 'ON';
  const color = !isOn ? 'var(--text-muted)'
    : temperature <= 20 ? 'var(--color-sky)'
    : 'var(--color-emerald)';
  const bg    = !isOn ? '#f1f5f9'
    : temperature <= 20 ? '#e0f2fe'
    : '#dcfce7';

  return (
    <div className="card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1rem' }}>
        <span className="metric-label">Target Temperature</span>
        <div style={{ background:bg, padding:'.5rem', borderRadius:'10px' }}>
          <Thermometer size={18} color={color} />
        </div>
      </div>
      <p className="metric-value" style={{ color, marginBottom:'.6rem' }}>
        {isOn && temperature ? `${temperature}°C` : '—'}
      </p>
      {isOn && temperature ? (
        <span className="badge" style={{ background:bg, color, borderColor:'transparent', fontSize:'.75rem' }}>
          <Snowflake size={11} />
          {temperature <= 20 ? 'Max Cooling — High Density' : 'Eco Cooling — Standard'}
        </span>
      ) : (
        <span className="badge badge-off" style={{ fontSize:'.75rem' }}>AC Off — No Cooling</span>
      )}
    </div>
  );
}
