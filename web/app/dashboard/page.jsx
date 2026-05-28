'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const POLL_MS = 3000;

const css = `
:root {
  --bg:#08090c; --surface:#0f1015; --card:#13141a; --border:#1e2030; --border2:#252a38;
  --accent:#00d4ff; --text:#e2e8f0; --muted:#4a5168; --dim:#252a38;
}
.sd-page { min-height:100vh; padding:32px 40px; font-family:'Space Grotesk',sans-serif; color:var(--text); background:var(--bg); box-sizing:border-box; }
.sd-header { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom:28px; }
.sd-title { font-size:24px; font-weight:700; color:var(--accent); }
.sd-subtitle { font-size:11px; color:var(--muted); font-family:'DM Mono',monospace; margin-top:4px; }
.sd-clock { text-align:right; }
.sd-clock-time { font-size:28px; font-weight:700; font-family:'DM Mono',monospace; color:var(--text); letter-spacing:.04em; }
.sd-clock-label { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; margin-top:2px; }

.sd-pills { display:flex; gap:10px; margin-bottom:24px; flex-wrap:wrap; }
.sd-pill { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:12px 16px; min-width:90px; }
.sd-pill-num { font-size:22px; font-weight:700; line-height:1; }
.sd-pill-label { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; text-transform:uppercase; letter-spacing:.08em; margin-top:6px; }

.sd-table-wrap { background:var(--card); border:1px solid var(--border); border-radius:14px; overflow:hidden; }
.sd-table { width:100%; border-collapse:collapse; }
.sd-table thead th { text-align:left; padding:14px 20px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); font-family:'DM Mono',monospace; background:var(--surface); border-bottom:1px solid var(--border); }
.sd-table tbody td { padding:16px 20px; border-bottom:1px solid var(--border); vertical-align:middle; }
.sd-table tbody tr:last-child td { border-bottom:none; }
.sd-table tbody tr:hover { background:rgba(0,212,255,0.03); }

.sd-eng { display:flex; align-items:center; gap:12px; }
.sd-eng-ring { width:32px; height:32px; border-radius:50%; border:2px solid; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; flex-shrink:0; }
.sd-eng-name { font-size:13px; font-weight:600; }
.sd-eng-email { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; margin-top:1px; }

.sd-status-cell { font-size:13px; font-weight:600; }
.sd-status-sub { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; margin-top:2px; }

.sd-reason { font-size:12px; color:#cbd5e1; font-style:italic; max-width:280px; }
.sd-reason-empty { color:var(--muted); font-style:normal; font-family:'DM Mono',monospace; font-size:11px; }

.sd-rt { display:flex; align-items:center; gap:8px; }
.sd-rt-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; box-shadow:0 0 6px currentColor; animation:sd-pulse 1.2s ease-in-out infinite; }
@keyframes sd-pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.45; transform:scale(0.8); } }
.sd-rt-dur { font-size:13px; font-weight:700; font-family:'DM Mono',monospace; letter-spacing:.02em; }
.sd-rt-since { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; margin-top:2px; }

.sd-prev-status { font-size:13px; font-weight:600; }
.sd-prev-dur { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; margin-top:2px; }
.sd-prev-empty { font-size:11px; color:var(--muted); font-family:'DM Mono',monospace; }

.sd-empty { padding:48px 20px; text-align:center; color:var(--muted); font-family:'DM Mono',monospace; font-size:13px; }
.sd-error { background:#ef444415; border:1px solid #ef444433; color:#fca5a5; border-radius:10px; padding:14px 18px; margin-bottom:20px; font-size:12px; font-family:'DM Mono',monospace; }
`;

function getColor(s) {
  if (!s) return '#475569';
  const t = s.toLowerCase();
  if (t === 'available') return '#10d98a';
  if (t === 'on call') return '#3b82f6';
  if (t.startsWith('on break') || t.startsWith('break')) return '#f5a623';
  if (t.startsWith('work offline')) return '#7b61ff';
  return '#475569';
}

function formatDuration(ms) {
  if (!ms || ms < 0) return '0s';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function currentReason(agent) {
  const h = agent.history || [];
  for (const entry of h) {
    if (entry.reason) return entry.reason;
  }
  return '';
}

function splitStatus(status) {
  const s = status || 'Offline';
  const hasSub = s.includes(' — ');
  return {
    main: hasSub ? s.split(' — ')[0] : s,
    sub: hasSub ? s.split(' — ').slice(1).join(' — ') : '',
  };
}

function Row({ agent, now }) {
  const color = getColor(agent.status);
  const initial = (agent.name || '?')[0].toUpperCase();
  const { main, sub } = splitStatus(agent.status);
  const reason = currentReason(agent);
  const since = agent.since || now;
  const elapsed = now - since;

  const prev = (agent.history || [])[0];
  const prevColor = prev ? getColor(prev.status) : '#475569';
  const prevSplit = prev ? splitStatus(prev.status) : null;
  const prevDur = prev && prev.from && prev.to ? prev.to - prev.from : null;

  return (
    <tr>
      <td>
        <div className="sd-eng">
          <div className="sd-eng-ring" style={{ borderColor: color, color }}>{initial}</div>
          <div>
            <div className="sd-eng-name">{agent.name || agent.id}</div>
            {agent.id !== agent.name && <div className="sd-eng-email">{agent.id}</div>}
          </div>
        </div>
      </td>
      <td>
        <div className="sd-status-cell" style={{ color }}>{main}</div>
        {sub && <div className="sd-status-sub">{sub}</div>}
      </td>
      <td>
        <div className="sd-rt">
          <div className="sd-rt-dot" style={{ background: color, color }} />
          <div>
            <div className="sd-rt-dur" style={{ color }}>{formatDuration(elapsed)}</div>
            <div className="sd-rt-since">since {formatTime(agent.since)}</div>
          </div>
        </div>
      </td>
      <td>
        {reason
          ? <div className="sd-reason">{reason}</div>
          : <div className="sd-reason sd-reason-empty">—</div>}
      </td>
      <td>
        {prev ? (
          <>
            <div className="sd-prev-status" style={{ color: prevColor }}>
              {prevSplit.main}{prevSplit.sub ? ` — ${prevSplit.sub}` : ''}
            </div>
            {prevDur != null && <div className="sd-prev-dur">lasted {formatDuration(prevDur)}</div>}
          </>
        ) : (
          <div className="sd-prev-empty">—</div>
        )}
      </td>
    </tr>
  );
}

function DashboardInner() {
  const params = useSearchParams();
  const squadId = params.get('squad') || '';
  const [agents, setAgents] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const aliveRef = useRef(true);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!squadId) return;
    aliveRef.current = true;
    let timer = null;
    async function load() {
      try {
        const res = await fetch(`/api/squad/${encodeURIComponent(squadId)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!aliveRef.current) return;
        setAgents(Array.isArray(data.agents) ? data.agents : []);
        setLastUpdated(data.lastUpdated || null);
        setError(null);
      } catch (e) {
        if (aliveRef.current) setError(e.message || 'fetch failed');
      } finally {
        if (aliveRef.current) timer = setTimeout(load, POLL_MS);
      }
    }
    load();
    return () => {
      aliveRef.current = false;
      if (timer) clearTimeout(timer);
    };
  }, [squadId]);

  if (!squadId) {
    return (
      <div className="sd-page">
        <div className="sd-empty">
          Missing squad ID. <a href="/" style={{ color: '#00d4ff' }}>Go back home</a>.
        </div>
      </div>
    );
  }

  const sorted = [...agents].sort((a, b) => {
    const order = { 'On Call': 0, 'Available': 1 };
    const oa = a.status?.startsWith('On Break') ? 2 : (a.status?.startsWith('Work Offline') ? 3 : (order[a.status] ?? 4));
    const ob = b.status?.startsWith('On Break') ? 2 : (b.status?.startsWith('Work Offline') ? 3 : (order[b.status] ?? 4));
    if (oa !== ob) return oa - ob;
    return (a.name || '').localeCompare(b.name || '');
  });

  const available = agents.filter((a) => a.status === 'Available').length;
  const onCall = agents.filter((a) => a.status === 'On Call').length;
  const onBreak = agents.filter((a) => a.status?.startsWith('On Break')).length;
  const offline = agents.filter((a) => !a.status || a.status === 'Offline' || a.status.startsWith('Work Offline')).length;

  return (
    <div className="sd-page">
      <div className="sd-header">
        <div>
          <div className="sd-title">Squad Dashboard</div>
          <div className="sd-subtitle">
            {squadId} · {agents.length} reporting · auto-refresh {POLL_MS / 1000}s
            {lastUpdated && ` · last update ${formatTime(lastUpdated)}`}
          </div>
        </div>
        <div className="sd-clock">
          <div className="sd-clock-time">{new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
          <div className="sd-clock-label">{new Date(now).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</div>
        </div>
      </div>

      {error && <div className="sd-error">Failed to load: {error}</div>}

      <div className="sd-pills">
        <div className="sd-pill"><div className="sd-pill-num" style={{ color: '#10d98a' }}>{available}</div><div className="sd-pill-label">Available</div></div>
        <div className="sd-pill"><div className="sd-pill-num" style={{ color: '#3b82f6' }}>{onCall}</div><div className="sd-pill-label">On Call</div></div>
        <div className="sd-pill"><div className="sd-pill-num" style={{ color: '#f5a623' }}>{onBreak}</div><div className="sd-pill-label">On Break</div></div>
        <div className="sd-pill"><div className="sd-pill-num" style={{ color: '#7b61ff' }}>{offline}</div><div className="sd-pill-label">Offline / WO</div></div>
      </div>

      <div className="sd-table-wrap">
        {sorted.length === 0 ? (
          <div className="sd-empty">No agents reporting yet. Waiting for the first status push from the extension…</div>
        ) : (
          <table className="sd-table">
            <thead>
              <tr>
                <th style={{ width: '24%' }}>Engineer</th>
                <th style={{ width: '18%' }}>Current Status</th>
                <th style={{ width: '16%' }}>Realtime</th>
                <th style={{ width: '24%' }}>Reason</th>
                <th style={{ width: '18%' }}>Previous Status</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((a) => <Row key={a.id} agent={a} now={now} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <Suspense fallback={<div style={{ padding: 24, fontFamily: "'DM Mono',monospace" }}>Loading…</div>}>
        <DashboardInner />
      </Suspense>
    </>
  );
}
