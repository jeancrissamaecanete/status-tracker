'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const POLL_MS = 3000;

const css = `
:root {
  --bg:#08090c; --surface:#0f1015; --card:#13141a; --border:#1e2030; --border2:#252a38;
  --accent:#00d4ff; --text:#e2e8f0; --muted:#4a5168; --dim:#252a38;
}
.sd-root { display:flex; height:100vh; overflow:hidden; font-family:'Space Grotesk',sans-serif; color:var(--text); background:var(--bg); }

.sd-sidebar { width:220px; background:var(--surface); border-right:1px solid var(--border); display:flex; flex-direction:column; flex-shrink:0; }
.sd-sidebar-header { padding:16px; border-bottom:1px solid var(--border); }
.sd-sidebar-title { font-size:13px; font-weight:700; color:var(--accent); }
.sd-sidebar-sub { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; margin-top:2px; }
.sd-summary-pills { display:flex; gap:6px; margin-top:10px; flex-wrap:wrap; }
.sd-summary-pill { display:flex; flex-direction:column; align-items:center; background:var(--card); border:1px solid var(--border); border-radius:8px; padding:5px 8px; min-width:48px; }
.sd-summary-pill-num { font-size:16px; font-weight:700; line-height:1; }
.sd-summary-pill-label { font-size:9px; color:var(--muted); font-family:'DM Mono',monospace; margin-top:2px; }
.sd-agent-list { flex:1; overflow-y:auto; padding:8px; }
.sd-agent-item { display:flex; align-items:center; gap:10px; padding:10px 10px; border-radius:10px; cursor:pointer; margin-bottom:4px; border:1px solid transparent; transition:all .15s; }
.sd-agent-item:hover { background:var(--card); border-color:var(--border); }
.sd-agent-item.selected { background:var(--card); border-color:var(--accent); }
.sd-agent-ring { width:34px; height:34px; border-radius:50%; border:2px solid; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; flex-shrink:0; }
.sd-agent-info { min-width:0; }
.sd-agent-name { font-size:12px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sd-agent-status { font-size:10px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-family:'DM Mono',monospace; }
.sd-last-updated { padding:10px 14px; font-size:9px; color:var(--muted); font-family:'DM Mono',monospace; border-top:1px solid var(--border); }

.sd-main { flex:1; overflow-y:auto; padding:28px; }
.sd-placeholder { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--muted); font-family:'DM Mono',monospace; font-size:13px; gap:12px; }
.sd-placeholder-icon { font-size:48px; opacity:0.4; }

.sd-hero { background:var(--card); border:1px solid var(--border2); border-radius:16px; padding:22px 24px; margin-bottom:20px; display:flex; align-items:center; gap:18px; }
.sd-hero-ring { width:56px; height:56px; border-radius:50%; border:3px solid; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:700; flex-shrink:0; }
.sd-hero-name { font-size:20px; font-weight:700; }
.sd-hero-status { font-size:13px; margin-top:3px; }
.sd-hero-timer { font-size:11px; color:var(--muted); font-family:'DM Mono',monospace; margin-top:4px; }

.sd-section-title { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); margin-bottom:12px; font-family:'DM Mono',monospace; }
.sd-stats-row { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:20px; }
.sd-stat-card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:14px 16px; }
.sd-stat-card-label { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; text-transform:uppercase; letter-spacing:.08em; }
.sd-stat-card-value { font-size:22px; font-weight:700; margin:4px 0 2px; }
.sd-stat-card-sub { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; }

.sd-timeline { display:flex; flex-direction:column; gap:4px; margin-bottom:20px; }
.sd-tl-row { display:flex; align-items:flex-start; gap:10px; padding:9px 12px; background:var(--card); border:1px solid var(--border); border-radius:8px; }
.sd-tl-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; margin-top:4px; }
.sd-tl-status { font-size:12px; font-weight:500; flex:1; }
.sd-tl-time { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; white-space:nowrap; }
.sd-tl-dur { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; }

.sd-lcu-section { margin-top:20px; }
.sd-lcu-list { background:var(--card); border:1px solid var(--border); border-radius:12px; overflow:hidden; }
.sd-lcu-empty { padding:20px; text-align:center; color:var(--muted); font-size:12px; font-family:'DM Mono',monospace; }
.sd-lcu-row { border-bottom:1px solid var(--border); }
.sd-lcu-row:last-child { border-bottom:none; }
.sd-lcu-row-header { display:flex; align-items:center; gap:12px; padding:12px 16px; cursor:pointer; transition:background .15s; }
.sd-lcu-row-header:hover { background:var(--surface); }
.sd-lcu-icon { font-size:14px; flex-shrink:0; }
.sd-lcu-row-info { flex:1; min-width:0; }
.sd-lcu-case-num { font-size:13px; font-weight:600; font-family:'DM Mono',monospace; }
.sd-lcu-meta { font-size:11px; color:var(--muted); font-family:'DM Mono',monospace; margin-top:2px; }
.sd-lcu-arrow { font-size:11px; color:var(--muted); transition:transform .2s; }
.sd-lcu-arrow.open { transform:rotate(180deg); }
.sd-lcu-body { padding:0 16px 14px; background:var(--surface); }
.sd-lcu-badge { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px; font-size:10px; font-weight:600; font-family:'DM Mono',monospace; margin-bottom:8px; }
.sd-lcu-preview { font-family:'DM Mono',monospace; font-size:11px; color:#94a3b8; background:var(--bg); padding:10px 12px; border-radius:8px; border:1px solid var(--border); white-space:pre-wrap; line-height:1.8; }
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

function Sidebar({ agents, selectedId, onSelect, lastUpdated }) {
  const available = agents.filter((a) => a.status === 'Available').length;
  const onCall = agents.filter((a) => a.status === 'On Call').length;
  const onBreak = agents.filter((a) => a.status?.startsWith('On Break')).length;

  return (
    <div className="sd-sidebar">
      <div className="sd-sidebar-header">
        <div className="sd-sidebar-title">Squad Dashboard</div>
        <div className="sd-sidebar-sub">Live status · auto-refresh</div>
        <div className="sd-summary-pills">
          <div className="sd-summary-pill">
            <div className="sd-summary-pill-num" style={{ color: '#10d98a' }}>{available}</div>
            <div className="sd-summary-pill-label">Avail</div>
          </div>
          <div className="sd-summary-pill">
            <div className="sd-summary-pill-num" style={{ color: '#3b82f6' }}>{onCall}</div>
            <div className="sd-summary-pill-label">On Call</div>
          </div>
          <div className="sd-summary-pill">
            <div className="sd-summary-pill-num" style={{ color: '#f5a623' }}>{onBreak}</div>
            <div className="sd-summary-pill-label">Break</div>
          </div>
        </div>
      </div>
      <div className="sd-agent-list">
        {agents.length === 0 && (
          <div style={{ padding: 12, fontSize: 11, color: '#475569', fontFamily: "'DM Mono',monospace" }}>
            No agents reporting yet
          </div>
        )}
        {agents.map((a) => {
          const color = getColor(a.status);
          const initial = (a.name || '?')[0].toUpperCase();
          const sub = a.status?.includes(' — ') ? a.status.split(' — ')[1] : a.status || 'Offline';
          return (
            <div
              key={a.id}
              className={'sd-agent-item' + (a.id === selectedId ? ' selected' : '')}
              onClick={() => onSelect(a.id)}
            >
              <div className="sd-agent-ring" style={{ borderColor: color, color }}>{initial}</div>
              <div className="sd-agent-info">
                <div className="sd-agent-name">{a.name}</div>
                <div className="sd-agent-status">{sub}</div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="sd-last-updated">
        {lastUpdated ? `Updated ${new Date(lastUpdated).toLocaleTimeString()}` : '—'}
      </div>
    </div>
  );
}

function Detail({ agent }) {
  const [now, setNow] = useState(() => Date.now());
  const [openReasons, setOpenReasons] = useState({});
  const [openCalls, setOpenCalls] = useState({});

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!agent) {
    return (
      <div className="sd-main">
        <div className="sd-placeholder">
          <div className="sd-placeholder-icon">👈</div>
          <div>Select an engineer to view details</div>
        </div>
      </div>
    );
  }

  const color = getColor(agent.status);
  const since = agent.since || now;
  const elapsed = now - since;
  const initial = (agent.name || '?')[0].toUpperCase();

  const bt = agent.breakTotals || {};
  const liveAdd = (key) => (agent.status === key && since ? now - since : 0);
  const restroomMs = (bt.restroom || 0) + liveAdd('On Break — Restroom');
  const thirtyMinMs = (bt.thirtyMin || 0) + liveAdd('On Break — 30 Min Break');
  const lunchMs = (bt.lunch || 0) + liveAdd('On Break — Lunch');

  const rColor = restroomMs > 15 * 60 * 1000 ? '#ef4444' : '#10d98a';
  const bColor = thirtyMinMs > 30 * 60 * 1000 ? '#ef4444' : '#10d98a';
  const lColor = lunchMs > 60 * 60 * 1000 ? '#ef4444' : '#10d98a';
  const rSub = restroomMs > 15 * 60 * 1000 ? '⚠ over 15m limit' : 'of 15m limit';
  const bSub = thirtyMinMs > 30 * 60 * 1000 ? '⚠ over 30m limit' : 'of 30m limit';
  const lSub = lunchMs > 60 * 60 * 1000 ? '⚠ over 1h limit' : 'of 1h limit';

  const history = agent.history || [];
  const lastBreak = [...history].find((h) => h.status?.startsWith('On Break'));
  const firstEntry = history.length ? history[history.length - 1] : null;
  const shiftMs = firstEntry ? now - firstEntry.from : 0;

  const longCalls = (agent.longCallUpdates || []).filter((u) => u.type === 'longCall' || !u.type);
  const disconnected = (agent.longCallUpdates || []).filter((u) => u.type === 'disconnected');

  return (
    <div className="sd-main">
      <div className="sd-hero">
        <div className="sd-hero-ring" style={{ borderColor: color, color }}>{initial}</div>
        <div>
          <div className="sd-hero-name">{agent.name}</div>
          <div className="sd-hero-status" style={{ color }}>{agent.status || 'Offline'}</div>
          <div className="sd-hero-timer">for {formatDuration(elapsed)}</div>
        </div>
      </div>

      <div className="sd-section-title">Stats</div>
      <div className="sd-stats-row">
        <div className="sd-stat-card">
          <div className="sd-stat-card-label">Status changes</div>
          <div className="sd-stat-card-value">{history.length}</div>
          <div className="sd-stat-card-sub">this session</div>
        </div>
        <div className="sd-stat-card">
          <div className="sd-stat-card-label">Last break</div>
          <div className="sd-stat-card-value" style={{ fontSize: 16, paddingTop: 4 }}>
            {lastBreak ? formatDuration(lastBreak.to - lastBreak.from) : '—'}
          </div>
          <div className="sd-stat-card-sub">
            {lastBreak ? new Date(lastBreak.from).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'no breaks'}
          </div>
        </div>
        <div className="sd-stat-card">
          <div className="sd-stat-card-label">Shift duration</div>
          <div className="sd-stat-card-value">{formatDuration(shiftMs)}</div>
          <div className="sd-stat-card-sub">since first status</div>
        </div>
      </div>

      <div className="sd-section-title">Break Time Usage</div>
      <div className="sd-stats-row">
        <div className="sd-stat-card">
          <div className="sd-stat-card-label">🚻 Restroom</div>
          <div className="sd-stat-card-value" style={{ fontSize: 20, color: rColor }}>{formatDuration(restroomMs) || '0s'}</div>
          <div className="sd-stat-card-sub">{rSub}</div>
        </div>
        <div className="sd-stat-card">
          <div className="sd-stat-card-label">☕ 30 Min Break</div>
          <div className="sd-stat-card-value" style={{ fontSize: 20, color: bColor }}>{formatDuration(thirtyMinMs) || '0s'}</div>
          <div className="sd-stat-card-sub">{bSub}</div>
        </div>
        <div className="sd-stat-card">
          <div className="sd-stat-card-label">🍽 Lunch</div>
          <div className="sd-stat-card-value" style={{ fontSize: 20, color: lColor }}>{formatDuration(lunchMs) || '0s'}</div>
          <div className="sd-stat-card-sub">{lSub}</div>
        </div>
      </div>

      <div className="sd-section-title">Status History</div>
      <div className="sd-timeline">
        {history.length === 0 && (
          <div style={{ color: '#475569', fontSize: 12, fontFamily: "'DM Mono',monospace", padding: 8 }}>
            No history yet
          </div>
        )}
        {history.map((h, i) => {
          const c = getColor(h.status);
          const dur = h.to ? formatDuration(h.to - h.from) : '—';
          const time = new Date(h.from).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const hasParts = h.status?.includes(' — ');
          const isReasonOpen = !!openReasons[i];
          return (
            <div key={i} className="sd-tl-row">
              <div className="sd-tl-dot" style={{ background: c }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="sd-tl-status">
                  {hasParts ? (
                    <>
                      {h.status.split(' — ')[0]}{' '}
                      <span style={{ color: '#64748b' }}>— {h.status.split(' — ').slice(1).join(' — ')}</span>
                    </>
                  ) : (
                    h.status || 'Offline'
                  )}
                </div>
                {h.reason && (
                  <>
                    <div
                      onClick={() => setOpenReasons((p) => ({ ...p, [i]: !p[i] }))}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        marginTop: 5,
                        cursor: 'pointer',
                        padding: '2px 7px 2px 4px',
                        borderRadius: 4,
                        border: '1px solid #7b61ff33',
                        background: '#7b61ff0d',
                        userSelect: 'none',
                        fontSize: 10,
                        color: '#a78bfa',
                      }}
                    >
                      <span>Reason</span>
                      <span style={{ transition: 'transform .2s', transform: isReasonOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
                    </div>
                    {isReasonOpen && (
                      <div style={{ marginTop: 5, fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                        {h.reason}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="sd-tl-time">{time}</div>
                <div className="sd-tl-dur">{dur}</div>
              </div>
            </div>
          );
        })}
      </div>

      <CallList
        title="Long Call Updates"
        updates={longCalls}
        icon="📞"
        badgeLabel="⏱ LONG CALL UPDATE"
        badgeStyle={{ background: '#ef444415', border: '1px solid #ef444433', color: '#f87171' }}
        listKey="lc"
        openCalls={openCalls}
        setOpenCalls={setOpenCalls}
      />
      <CallList
        title="Disconnected Call Updates"
        updates={disconnected}
        icon="📵"
        badgeLabel="📵 DISCONNECTED CALL"
        badgeStyle={{ background: '#f59e0b15', border: '1px solid #f59e0b33', color: '#fbbf24' }}
        listKey="dc"
        openCalls={openCalls}
        setOpenCalls={setOpenCalls}
      />
    </div>
  );
}

function CallList({ title, updates, icon, badgeLabel, badgeStyle, listKey, openCalls, setOpenCalls }) {
  return (
    <div className="sd-lcu-section">
      <div className="sd-section-title">{title}</div>
      <div className="sd-lcu-list">
        {!updates.length && <div className="sd-lcu-empty">No updates recorded</div>}
        {updates.map((u, i) => {
          const uid = `${listKey}-${i}`;
          const isOpen = !!openCalls[uid];
          const time = new Date(u.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const date = new Date(u.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
          return (
            <div key={uid} className="sd-lcu-row">
              <div
                className="sd-lcu-row-header"
                onClick={() => setOpenCalls((p) => ({ ...p, [uid]: !p[uid] }))}
              >
                <div className="sd-lcu-icon">{icon}</div>
                <div className="sd-lcu-row-info">
                  <div className="sd-lcu-case-num">{u.caseNum || 'No case number'}</div>
                  <div className="sd-lcu-meta">{date} · {time} · {u.skillset || ''} · {u.team || ''}</div>
                </div>
                <div className={'sd-lcu-arrow' + (isOpen ? ' open' : '')}>▾</div>
              </div>
              {isOpen && (
                <div className="sd-lcu-body">
                  <div className="sd-lcu-badge" style={badgeStyle}>{badgeLabel}</div>
                  <div className="sd-lcu-preview">{u.preview || ''}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DashboardInner() {
  const params = useSearchParams();
  const squadId = params.get('squad') || '';
  const [agents, setAgents] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const aliveRef = useRef(true);

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
      <div className="sd-root">
        <div className="sd-main">
          <div className="sd-placeholder">
            <div className="sd-placeholder-icon">🔎</div>
            <div>Missing squad ID. Try <a href="/" style={{ color: '#00d4ff' }}>going back home</a>.</div>
          </div>
        </div>
      </div>
    );
  }

  const selected = agents.find((a) => a.id === selectedId);

  return (
    <div className="sd-root">
      <Sidebar
        agents={agents}
        selectedId={selectedId}
        onSelect={setSelectedId}
        lastUpdated={lastUpdated}
      />
      {error ? (
        <div className="sd-main">
          <div className="sd-placeholder">
            <div className="sd-placeholder-icon">⚠️</div>
            <div>Failed to load squad: {error}</div>
          </div>
        </div>
      ) : (
        <Detail agent={selected} />
      )}
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
