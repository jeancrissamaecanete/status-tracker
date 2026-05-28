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

.sd-tabs { display:flex; gap:4px; margin-bottom:20px; border-bottom:1px solid var(--border); }
.sd-tab { background:none; border:none; padding:12px 18px; font-size:12px; font-weight:600; color:var(--muted); cursor:pointer; font-family:'Space Grotesk',sans-serif; letter-spacing:.04em; text-transform:uppercase; border-bottom:2px solid transparent; transition:color .15s, border-color .15s; }
.sd-tab:hover { color:var(--text); }
.sd-tab.active { color:var(--accent); border-bottom-color:var(--accent); }
.sd-tab-count { display:inline-block; margin-left:6px; padding:1px 7px; border-radius:8px; background:var(--border); color:var(--muted); font-size:10px; font-family:'DM Mono',monospace; }
.sd-tab.active .sd-tab-count { background:rgba(0,212,255,0.15); color:var(--accent); }

.sd-subtabs { display:flex; gap:8px; margin-bottom:18px; }
.sd-subtab { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:10px 16px; font-size:11px; font-weight:600; color:var(--muted); cursor:pointer; font-family:'DM Mono',monospace; letter-spacing:.04em; text-transform:uppercase; transition:all .15s; }
.sd-subtab:hover { color:var(--text); border-color:var(--border2); }
.sd-subtab.active { color:var(--text); border-color:var(--accent); background:rgba(0,212,255,0.06); }

.sd-hist-row { display:grid; grid-template-columns:200px 130px 140px 1fr 60px; gap:16px; padding:14px 20px; border-bottom:1px solid var(--border); align-items:center; cursor:pointer; transition:background .12s; }
.sd-hist-row:last-child { border-bottom:none; }
.sd-hist-row:hover { background:rgba(0,212,255,0.03); }
.sd-hist-time { font-size:12px; font-family:'DM Mono',monospace; color:var(--text); }
.sd-hist-time-sub { font-size:10px; color:var(--muted); margin-top:2px; }
.sd-hist-case { font-size:13px; font-weight:600; color:var(--text); font-family:'DM Mono',monospace; }
.sd-hist-team { font-size:11px; color:var(--muted); font-family:'DM Mono',monospace; }
.sd-hist-issue { font-size:12px; color:#cbd5e1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sd-hist-arrow { color:var(--muted); font-size:14px; text-align:right; transition:transform .15s; }
.sd-hist-arrow.open { transform:rotate(180deg); color:var(--accent); }
.sd-hist-body { padding:0 20px 16px 20px; display:none; border-bottom:1px solid var(--border); background:var(--surface); }
.sd-hist-body.open { display:block; }
.sd-hist-field { margin-top:12px; }
.sd-hist-label { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; text-transform:uppercase; letter-spacing:.08em; margin-bottom:4px; }
.sd-hist-value { font-size:12px; color:var(--text); white-space:pre-wrap; word-break:break-word; line-height:1.5; }
.sd-hist-preview { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:12px 14px; font-family:'DM Mono',monospace; font-size:11px; color:#cbd5e1; white-space:pre-wrap; word-break:break-word; max-height:300px; overflow-y:auto; }
.sd-hist-head { display:grid; grid-template-columns:200px 130px 140px 1fr 60px; gap:16px; padding:14px 20px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); font-family:'DM Mono',monospace; background:var(--surface); border-bottom:1px solid var(--border); }

.sd-filters { display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap; align-items:center; }
.sd-filter-search { flex:1; min-width:240px; position:relative; }
.sd-filter-search input { width:100%; padding:10px 14px 10px 36px; background:var(--card); border:1px solid var(--border); border-radius:10px; color:var(--text); font-size:13px; font-family:'Space Grotesk',sans-serif; outline:none; transition:border-color .15s; box-sizing:border-box; }
.sd-filter-search input:focus { border-color:var(--accent); }
.sd-filter-search input::placeholder { color:var(--muted); }
.sd-filter-search-icon { position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--muted); font-size:14px; pointer-events:none; }
.sd-filter-date, .sd-filter-team { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:10px 12px; color:var(--text); font-size:12px; font-family:'DM Mono',monospace; outline:none; transition:border-color .15s; }
.sd-filter-date:focus, .sd-filter-team:focus { border-color:var(--accent); }
.sd-filter-date { color-scheme:dark; min-width:140px; }
.sd-filter-team { min-width:140px; cursor:pointer; }
.sd-filter-label { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; text-transform:uppercase; letter-spacing:.08em; margin-right:4px; }
.sd-filter-clear { background:none; border:1px solid var(--border); color:var(--muted); padding:9px 12px; border-radius:10px; font-size:11px; font-family:'DM Mono',monospace; cursor:pointer; text-transform:uppercase; letter-spacing:.06em; transition:all .15s; }
.sd-filter-clear:hover { color:var(--text); border-color:var(--border2); }
.sd-filter-meta { font-size:11px; color:var(--muted); font-family:'DM Mono',monospace; margin-left:auto; }

.sd-rth-row { display:grid; grid-template-columns:200px 220px 140px 130px 1fr 60px; gap:16px; padding:14px 20px; border-bottom:1px solid var(--border); align-items:center; cursor:pointer; transition:background .12s; }
.sd-rth-row:last-child { border-bottom:none; }
.sd-rth-row:hover { background:rgba(0,212,255,0.03); }
.sd-rth-head { display:grid; grid-template-columns:200px 220px 140px 130px 1fr 60px; gap:16px; padding:14px 20px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.1em; color:var(--muted); font-family:'DM Mono',monospace; background:var(--surface); border-bottom:1px solid var(--border); }
.sd-rth-status { display:flex; align-items:center; gap:10px; }
.sd-rth-status-dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
.sd-rth-status-dot.live { animation:sd-pulse 1.2s ease-in-out infinite; box-shadow:0 0 6px currentColor; }
.sd-rth-status-text { font-size:13px; font-weight:600; }
.sd-rth-status-sub { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; margin-top:2px; }
.sd-rth-live-badge { display:inline-block; margin-left:8px; padding:2px 7px; font-size:9px; font-family:'DM Mono',monospace; font-weight:700; letter-spacing:.08em; border-radius:6px; background:rgba(16,217,138,0.15); color:#10d98a; border:1px solid rgba(16,217,138,0.3); text-transform:uppercase; }
.sd-rth-dur { font-size:13px; font-weight:700; font-family:'DM Mono',monospace; }
.sd-rth-dur.live { color:#10d98a; }
.sd-rth-time { font-size:12px; font-family:'DM Mono',monospace; color:var(--text); }
.sd-rth-time-sub { font-size:10px; color:var(--muted); font-family:'DM Mono',monospace; margin-top:2px; }
.sd-rth-reason { font-size:12px; color:#cbd5e1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-style:italic; }
.sd-rth-reason-empty { color:var(--muted); font-style:normal; font-family:'DM Mono',monospace; font-size:11px; }
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

function aggregateUpdates(agents, kind) {
  const out = [];
  for (const a of agents) {
    const list = a.longCallUpdates || [];
    for (const u of list) {
      const isLong = u.type === 'longCall' || !u.type;
      const isDisc = u.type === 'disconnected';
      if (kind === 'longCall' && !isLong) continue;
      if (kind === 'disconnected' && !isDisc) continue;
      out.push({ ...u, _agentId: a.id, _agentName: a.name || a.id });
    }
  }
  out.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return out;
}

function HistoryRow({ entry }) {
  const [open, setOpen] = useState(false);
  const date = entry.timestamp ? new Date(entry.timestamp) : null;
  const dateStr = date ? date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
  const timeStr = date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <>
      <div className="sd-hist-row" onClick={() => setOpen(!open)}>
        <div>
          <div className="sd-hist-time">{entry._agentName}</div>
          <div className="sd-hist-time-sub">{entry._agentId}</div>
        </div>
        <div>
          <div className="sd-hist-time">{timeStr}</div>
          <div className="sd-hist-time-sub">{dateStr}</div>
        </div>
        <div>
          <div className="sd-hist-case">{entry.caseNum || '—'}</div>
          <div className="sd-hist-team">{entry.skillset || ''}{entry.team ? ` · ${entry.team}` : ''}</div>
        </div>
        <div className="sd-hist-issue">{entry.issue || entry.reason || '—'}</div>
        <div className={`sd-hist-arrow${open ? ' open' : ''}`}>▾</div>
      </div>
      <div className={`sd-hist-body${open ? ' open' : ''}`}>
        {entry.siebelId && (
          <div className="sd-hist-field">
            <div className="sd-hist-label">Siebel ID</div>
            <div className="sd-hist-value">{entry.siebelId}</div>
          </div>
        )}
        {entry.issue && (
          <div className="sd-hist-field">
            <div className="sd-hist-label">Issue</div>
            <div className="sd-hist-value">{entry.issue}</div>
          </div>
        )}
        {entry.reason && (
          <div className="sd-hist-field">
            <div className="sd-hist-label">Reason</div>
            <div className="sd-hist-value">{entry.reason}</div>
          </div>
        )}
        {entry.preview && (
          <div className="sd-hist-field">
            <div className="sd-hist-label">Preview</div>
            <div className="sd-hist-preview">{entry.preview}</div>
          </div>
        )}
      </div>
    </>
  );
}

function startOfDay(ymd) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function endOfDay(ymd) {
  if (!ymd) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

function applyFilters(list, filters) {
  const q = filters.q.trim().toLowerCase();
  const from = startOfDay(filters.from);
  const to = endOfDay(filters.to);
  return list.filter((e) => {
    if (from != null && (!e.timestamp || e.timestamp < from)) return false;
    if (to != null && (!e.timestamp || e.timestamp > to)) return false;
    if (filters.team && e.team !== filters.team) return false;
    if (q) {
      const hay = [
        e._agentName, e._agentId, e.caseNum, e.siebelId,
        e.issue, e.reason, e.skillset, e.team, e.preview,
      ].map((v) => (v || '').toString().toLowerCase()).join(' ');
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function HistoryList({ entries, emptyMsg, filters, setFilters }) {
  const teams = Array.from(new Set(entries.map((e) => e.team).filter(Boolean))).sort();
  const filtered = applyFilters(entries, filters);
  const hasActive = filters.q || filters.from || filters.to || filters.team;

  return (
    <>
      <div className="sd-filters">
        <div className="sd-filter-search">
          <span className="sd-filter-search-icon">⌕</span>
          <input
            type="text"
            placeholder="Search engineer, case #, Siebel ID, issue, reason…"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
        </div>
        <span className="sd-filter-label">From</span>
        <input
          type="date"
          className="sd-filter-date"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
        />
        <span className="sd-filter-label">To</span>
        <input
          type="date"
          className="sd-filter-date"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
        />
        <select
          className="sd-filter-team"
          value={filters.team}
          onChange={(e) => setFilters({ ...filters, team: e.target.value })}
        >
          <option value="">All teams</option>
          {teams.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        {hasActive && (
          <button
            className="sd-filter-clear"
            onClick={() => setFilters({ q: '', from: '', to: '', team: '' })}
          >
            Clear
          </button>
        )}
        <span className="sd-filter-meta">
          {filtered.length} of {entries.length}
        </span>
      </div>
      <div className="sd-table-wrap">
        {filtered.length === 0 ? (
          <div className="sd-empty">{entries.length === 0 ? emptyMsg : 'No entries match these filters.'}</div>
        ) : (
          <>
            <div className="sd-hist-head">
              <div>Engineer</div>
              <div>Time</div>
              <div>Case #</div>
              <div>Issue / Reason</div>
              <div></div>
            </div>
            {filtered.map((entry, i) => (
              <HistoryRow key={`${entry._agentId}-${entry.timestamp}-${i}`} entry={entry} />
            ))}
          </>
        )}
      </div>
    </>
  );
}

function aggregateStatusHistory(agents) {
  const out = [];
  for (const a of agents) {
    if (a.status && a.since) {
      out.push({
        _agentId: a.id,
        _agentName: a.name || a.id,
        status: a.status,
        from: a.since,
        to: null,
        reason: currentReason(a),
        _live: true,
      });
    }
    for (const h of a.history || []) {
      out.push({
        _agentId: a.id,
        _agentName: a.name || a.id,
        status: h.status,
        from: h.from,
        to: h.to,
        reason: h.reason || '',
        _live: false,
      });
    }
  }
  out.sort((a, b) => (b.from || 0) - (a.from || 0));
  return out;
}

function applyStatusFilters(list, filters) {
  const q = filters.q.trim().toLowerCase();
  const from = startOfDay(filters.from);
  const to = endOfDay(filters.to);
  return list.filter((e) => {
    if (from != null && (!e.from || e.from < from)) return false;
    if (to != null && (!e.from || e.from > to)) return false;
    if (filters.status && e.status !== filters.status) return false;
    if (q) {
      const hay = [e._agentName, e._agentId, e.status, e.reason]
        .map((v) => (v || '').toString().toLowerCase()).join(' ');
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function RealtimeHistoryRow({ entry, now }) {
  const [open, setOpen] = useState(false);
  const color = getColor(entry.status);
  const split = splitStatus(entry.status);
  const endTs = entry._live ? now : entry.to;
  const duration = endTs && entry.from ? endTs - entry.from : null;
  const date = entry.from ? new Date(entry.from) : null;
  const timeStr = date ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
  const dateStr = date ? date.toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
  const initial = (entry._agentName || '?')[0].toUpperCase();
  const hasReason = !!entry.reason;

  return (
    <>
      <div
        className="sd-rth-row"
        onClick={() => hasReason && setOpen(!open)}
        style={{ cursor: hasReason ? 'pointer' : 'default' }}
      >
        <div className="sd-eng">
          <div className="sd-eng-ring" style={{ borderColor: color, color }}>{initial}</div>
          <div>
            <div className="sd-eng-name">{entry._agentName}</div>
            {entry._agentId !== entry._agentName && <div className="sd-eng-email">{entry._agentId}</div>}
          </div>
        </div>
        <div className="sd-rth-status">
          <div
            className={`sd-rth-status-dot${entry._live ? ' live' : ''}`}
            style={{ background: color, color }}
          />
          <div>
            <div className="sd-rth-status-text" style={{ color }}>
              {split.main}
              {entry._live && <span className="sd-rth-live-badge">Live</span>}
            </div>
            {split.sub && <div className="sd-rth-status-sub">{split.sub}</div>}
          </div>
        </div>
        <div>
          <div className="sd-rth-time">{timeStr}</div>
          <div className="sd-rth-time-sub">{dateStr}</div>
        </div>
        <div>
          <div className={`sd-rth-dur${entry._live ? ' live' : ''}`}>
            {duration != null ? formatDuration(duration) : '—'}
          </div>
          <div className="sd-rth-time-sub">{entry._live ? 'ongoing' : 'lasted'}</div>
        </div>
        <div className={hasReason ? 'sd-rth-reason' : 'sd-rth-reason sd-rth-reason-empty'}>
          {hasReason ? entry.reason : '—'}
        </div>
        <div className={`sd-hist-arrow${open ? ' open' : ''}`} style={{ visibility: hasReason ? 'visible' : 'hidden' }}>▾</div>
      </div>
      {hasReason && (
        <div className={`sd-hist-body${open ? ' open' : ''}`}>
          <div className="sd-hist-field">
            <div className="sd-hist-label">Reason</div>
            <div className="sd-hist-value">{entry.reason}</div>
          </div>
        </div>
      )}
    </>
  );
}

function RealtimeHistory({ agents, now, filters, setFilters }) {
  const entries = aggregateStatusHistory(agents);
  const statuses = Array.from(new Set(entries.map((e) => e.status).filter(Boolean))).sort();
  const filtered = applyStatusFilters(entries, filters);
  const hasActive = filters.q || filters.from || filters.to || filters.status;

  return (
    <>
      <div className="sd-filters">
        <div className="sd-filter-search">
          <span className="sd-filter-search-icon">⌕</span>
          <input
            type="text"
            placeholder="Search engineer, status, reason…"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
        </div>
        <span className="sd-filter-label">From</span>
        <input
          type="date"
          className="sd-filter-date"
          value={filters.from}
          onChange={(e) => setFilters({ ...filters, from: e.target.value })}
        />
        <span className="sd-filter-label">To</span>
        <input
          type="date"
          className="sd-filter-date"
          value={filters.to}
          onChange={(e) => setFilters({ ...filters, to: e.target.value })}
        />
        <select
          className="sd-filter-team"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {hasActive && (
          <button
            className="sd-filter-clear"
            onClick={() => setFilters({ q: '', from: '', to: '', status: '' })}
          >
            Clear
          </button>
        )}
        <span className="sd-filter-meta">{filtered.length} of {entries.length}</span>
      </div>
      <div className="sd-table-wrap">
        {filtered.length === 0 ? (
          <div className="sd-empty">
            {entries.length === 0 ? 'No status history recorded yet.' : 'No entries match these filters.'}
          </div>
        ) : (
          <>
            <div className="sd-rth-head">
              <div>Engineer</div>
              <div>Status</div>
              <div>Started</div>
              <div>Duration</div>
              <div>Reason</div>
              <div></div>
            </div>
            {filtered.map((entry, i) => (
              <RealtimeHistoryRow
                key={`${entry._agentId}-${entry.from}-${i}`}
                entry={entry}
                now={now}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}

const EMPTY_FILTERS = { q: '', from: '', to: '', team: '' };
const EMPTY_STATUS_FILTERS = { q: '', from: '', to: '', status: '' };

function CallHistory({ agents, historyTab, setHistoryTab }) {
  const longCall = aggregateUpdates(agents, 'longCall');
  const disconnected = aggregateUpdates(agents, 'disconnected');
  const [lcFilters, setLcFilters] = useState(EMPTY_FILTERS);
  const [dcFilters, setDcFilters] = useState(EMPTY_FILTERS);

  return (
    <>
      <div className="sd-subtabs">
        <button
          className={`sd-subtab${historyTab === 'longCall' ? ' active' : ''}`}
          onClick={() => setHistoryTab('longCall')}
        >
          Long Call Updates <span className="sd-tab-count">{longCall.length}</span>
        </button>
        <button
          className={`sd-subtab${historyTab === 'disconnected' ? ' active' : ''}`}
          onClick={() => setHistoryTab('disconnected')}
        >
          Disconnected Calls <span className="sd-tab-count">{disconnected.length}</span>
        </button>
      </div>
      {historyTab === 'longCall' ? (
        <HistoryList
          entries={longCall}
          emptyMsg="No long call updates recorded yet."
          filters={lcFilters}
          setFilters={setLcFilters}
        />
      ) : (
        <HistoryList
          entries={disconnected}
          emptyMsg="No disconnected call updates recorded yet."
          filters={dcFilters}
          setFilters={setDcFilters}
        />
      )}
    </>
  );
}

function DashboardInner() {
  const params = useSearchParams();
  const squadId = params.get('squad') || '';
  const [agents, setAgents] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [view, setView] = useState('status');
  const [historyTab, setHistoryTab] = useState('longCall');
  const [realtimeFilters, setRealtimeFilters] = useState(EMPTY_STATUS_FILTERS);
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
  const totalUpdates = agents.reduce((n, a) => n + (a.longCallUpdates?.length || 0), 0);
  const totalStatusEntries = agents.reduce((n, a) => n + (a.history?.length || 0) + (a.status && a.since ? 1 : 0), 0);

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

      <div className="sd-tabs">
        <button
          className={`sd-tab${view === 'status' ? ' active' : ''}`}
          onClick={() => setView('status')}
        >
          Live Status <span className="sd-tab-count">{agents.length}</span>
        </button>
        <button
          className={`sd-tab${view === 'realtime' ? ' active' : ''}`}
          onClick={() => setView('realtime')}
        >
          Real-time History <span className="sd-tab-count">{totalStatusEntries}</span>
        </button>
        <button
          className={`sd-tab${view === 'history' ? ' active' : ''}`}
          onClick={() => setView('history')}
        >
          Call History <span className="sd-tab-count">{totalUpdates}</span>
        </button>
      </div>

      {view === 'status' && (
        <>
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
        </>
      )}

      {view === 'realtime' && (
        <RealtimeHistory
          agents={agents}
          now={now}
          filters={realtimeFilters}
          setFilters={setRealtimeFilters}
        />
      )}

      {view === 'history' && (
        <CallHistory agents={agents} historyTab={historyTab} setHistoryTab={setHistoryTab} />
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
