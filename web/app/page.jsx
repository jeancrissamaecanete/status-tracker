'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [squadId, setSquadId] = useState('');
  const router = useRouter();

  function submit(e) {
    e.preventDefault();
    const s = squadId.trim();
    if (!s) return;
    router.push(`/dashboard?squad=${encodeURIComponent(s)}`);
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#13141a', border: '1px solid #252a38', borderRadius: 16, padding: 28 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#00d4ff', marginBottom: 6 }}>Squad Dashboard</div>
        <div style={{ fontSize: 12, color: '#4a5168', fontFamily: "'DM Mono', monospace", marginBottom: 22 }}>
          8x8 Tracker · enter your squad ID to view live status
        </div>
        <form onSubmit={submit}>
          <label style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: '#4a5168', marginBottom: 8 }}>
            Squad ID
          </label>
          <input
            value={squadId}
            onChange={(e) => setSquadId(e.target.value)}
            placeholder="e.g. trend-micro-bea"
            style={{
              width: '100%',
              background: '#0f1015',
              border: '1px solid #252a38',
              borderRadius: 8,
              color: '#e2e8f0',
              fontSize: 13,
              padding: '10px 12px',
              outline: 'none',
              marginBottom: 14,
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 8,
              border: 'none',
              background: '#00d4ff',
              color: '#0d0f14',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Open Dashboard
          </button>
        </form>
      </div>
    </main>
  );
}
