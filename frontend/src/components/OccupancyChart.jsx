import React from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Activity } from 'lucide-react';

export default function OccupancyChart({ history = [] }) {
  const chartData = (history.length > 0 ? history : []).map(item => {
    const level = item.occupancy === 'LOW' ? 1 : item.occupancy === 'MEDIUM' ? 2 : 3;
    return {
      time: item.timestamp,
      level,
      occupancy: item.occupancy,
      count: item.person_count,
      acState: item.ac_state,
      temp: item.temperature ? `${item.temperature}°C` : 'OFF',
    };
  });

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const color = d.occupancy === 'LOW' ? '#15803d' : d.occupancy === 'MEDIUM' ? '#b45309' : '#b91c1c';
    return (
      <div style={{ background:'#fff', border:'1px solid var(--border-color)', padding:'.75rem 1rem', borderRadius:'12px', boxShadow:'var(--shadow-md)', fontSize:'.82rem', minWidth:'180px' }}>
        <p className="font-mono" style={{ color:'var(--text-muted)', marginBottom:'.3rem' }}>{d.time}</p>
        <p style={{ fontWeight:700, color, marginBottom:'.2rem' }}>
          {d.occupancy} — {d.count} {d.count === 1 ? 'person' : 'people'}
        </p>
        <p style={{ color:'var(--text-secondary)' }}>
          AC: <strong>{d.acState}</strong> ({d.temp})
        </p>
      </div>
    );
  };

  return (
    <div className="card" style={{ marginBottom:'1.5rem' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'.6rem', marginBottom:'1.25rem' }}>
        <div style={{ background:'#eff6ff', padding:'.5rem', borderRadius:'10px' }}>
          <Activity size={18} color="var(--color-blue)" />
        </div>
        <div>
          <h3 style={{ fontSize:'1rem', fontWeight:600, color:'var(--text-primary)' }}>Occupancy & AC Activity Timeline</h3>
          <p style={{ fontSize:'.78rem', color:'var(--text-muted)' }}>
            Real-time log — every state change is recorded here
          </p>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div style={{ height:'200px', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', background:'var(--bg-card-2)', borderRadius:'12px', border:'1px solid var(--border-color)', flexDirection:'column', gap:'.5rem' }}>
          <Activity size={32} color="var(--border-accent)" />
          <p style={{ fontSize:'.85rem' }}>No events yet — simulate or analyze a video to populate the timeline</p>
        </div>
      ) : (
        <div style={{ width:'100%', height:230 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top:8, right:20, left:-20, bottom:0 }}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="time" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                domain={[0, 4]} ticks={[1, 2, 3]}
                tickFormatter={v => v === 1 ? 'LOW' : v === 2 ? 'MED' : 'HIGH'}
                stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={2} stroke="#e2e8f0" strokeDasharray="4 4" />
              <Area
                type="monotone" dataKey="level"
                stroke="#2563eb" strokeWidth={2.5}
                fillOpacity={1} fill="url(#grad)"
                dot={{ r:4, fill:'#2563eb', stroke:'#fff', strokeWidth:2 }}
                activeDot={{ r:7, fill:'#2563eb', stroke:'#fff', strokeWidth:2.5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
