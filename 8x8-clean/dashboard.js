// dashboard.js

function escHtml(s) {
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function getColor(s) {
  if (!s) return "#475569";
  const t = s.toLowerCase();
  if (t === "available") return "#10d98a";
  if (t === "on call")   return "#3b82f6";
  if (t.startsWith("on break") || t.startsWith("break")) return "#f5a623";
  if (t.startsWith("work offline")) return "#7b61ff";
  return "#475569";
}

function getBg(s) {
  const c = getColor(s);
  return c + "18";
}

function getBorder(s) {
  const c = getColor(s);
  return c + "44";
}

function formatDuration(ms) {
  if (!ms || ms < 0) return "0s";
  const h = Math.floor(ms/3600000), m = Math.floor((ms%3600000)/60000), s = Math.floor((ms%60000)/1000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmt12(t) {
  if (!t || !t.includes(":")) return "—";
  const [h,m] = t.split(":").map(Number);
  return (h%12||12)+":"+ String(m).padStart(2,"0") +" "+ (h>=12?"PM":"AM");
}

let agents = [];
let selectedId = null;
let tickInterval = null;

function loadAgents() {
  chrome.runtime.sendMessage({ type:"GET_AGENTS" }, r => {
    if (r?.agents) { agents = r.agents; render(); }
  });
}

chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === "AGENTS_UPDATED" && msg.agents) { agents = msg.agents; render(); }
});

function render() {
  renderSidebar();
  if (selectedId) renderDetail(agents.find(a => a.id === selectedId));
  document.getElementById("lastUpdated").textContent = "Updated " + new Date().toLocaleTimeString();
}

function renderSidebar() {
  const available = agents.filter(a => a.status === "Available").length;
  const onCall    = agents.filter(a => a.status === "On Call").length;
  const onBreak   = agents.filter(a => a.status?.startsWith("On Break")).length;

  document.getElementById("sidebarSummary").innerHTML = `
    <div class="summary-pill"><div class="summary-pill-num" style="color:#10d98a">${available}</div><div class="summary-pill-label">Avail</div></div>
    <div class="summary-pill"><div class="summary-pill-num" style="color:#3b82f6">${onCall}</div><div class="summary-pill-label">On Call</div></div>
    <div class="summary-pill"><div class="summary-pill-num" style="color:#f5a623">${onBreak}</div><div class="summary-pill-label">Break</div></div>
  `;

  const list = document.getElementById("agentList");
  list.innerHTML = agents.map(a => {
    const color = getColor(a.status);
    const initial = (a.name||"?")[0].toUpperCase();
    const sub = a.status?.includes(" — ") ? a.status.split(" — ")[1] : (a.status||"Offline");
    return `
      <div class="agent-item ${a.id === selectedId ? "selected" : ""}" data-id="${a.id}">
        <div class="agent-ring" style="border-color:${color};color:${color}">${initial}</div>
        <div class="agent-info">
          <div class="agent-name">${escHtml(a.name)}</div>
          <div class="agent-status">${escHtml(sub)}</div>
        </div>
      </div>`;
  }).join("");

  list.querySelectorAll(".agent-item").forEach(el => {
    el.addEventListener("click", () => {
      selectedId = el.dataset.id;
      list.querySelectorAll(".agent-item").forEach(x => x.classList.remove("selected"));
      el.classList.add("selected");
      renderDetail(agents.find(a => a.id === selectedId));
    });
  });
}

function renderDetail(agent) {
  if (!agent) return;
  const main = document.getElementById("main");
  const color = getColor(agent.status);
  const now = Date.now();
  const since = agent.since || now;
  const elapsed = now - since;
  const initial = (agent.name||"?")[0].toUpperCase();

  // Break totals
  const bt = agent.breakTotals || {};
  const restroomMs  = (bt.restroom||0)  + (agent.status==="On Break — Restroom"     && since ? now-since : 0);
  const thirtyMinMs = (bt.thirtyMin||0) + (agent.status==="On Break — 30 Min Break" && since ? now-since : 0);
  const lunchMs     = (bt.lunch||0)     + (agent.status==="On Break — Lunch"        && since ? now-since : 0);

  const rColor = restroomMs  > 15*60*1000 ? "#ef4444" : "#10d98a";
  const bColor = thirtyMinMs > 30*60*1000 ? "#ef4444" : "#10d98a";
  const lColor = lunchMs     > 60*60*1000 ? "#ef4444" : "#10d98a";
  const rSub   = restroomMs  > 15*60*1000 ? "⚠ over 15m limit" : "of 15m limit";
  const bSub   = thirtyMinMs > 30*60*1000 ? "⚠ over 30m limit" : "of 30m limit";
  const lSub   = lunchMs     > 60*60*1000 ? "⚠ over 1h limit"  : "of 1h limit";

  const history = agent.history || [];
  const lastBreak = [...history].find(h => h.status?.startsWith("On Break"));
  const firstEntry = history.length ? history[history.length-1] : null;
  const shiftMs = firstEntry ? (now - firstEntry.from) : 0;

  // Render
  main.innerHTML = `
    <div class="hero">
      <div class="hero-ring" style="border-color:${color};color:${color}">${initial}</div>
      <div>
        <div class="hero-name">${escHtml(agent.name)}</div>
        <div class="hero-status" style="color:${color}">${escHtml(agent.status||"Offline")}</div>
        <div class="hero-timer" id="heroTimer">for ${formatDuration(elapsed)}</div>
      </div>
    </div>

    <div class="section-title">Stats</div>
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-card-label">Status changes</div>
        <div class="stat-card-value">${history.length}</div>
        <div class="stat-card-sub">this session</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Last break</div>
        <div class="stat-card-value" style="font-size:16px;padding-top:4px">${lastBreak ? formatDuration(lastBreak.to - lastBreak.from) : "—"}</div>
        <div class="stat-card-sub">${lastBreak ? new Date(lastBreak.from).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "no breaks"}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Shift duration</div>
        <div class="stat-card-value">${formatDuration(shiftMs)}</div>
        <div class="stat-card-sub">since first status</div>
      </div>
    </div>

    <div class="section-title">Break Time Usage</div>
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-card-label">🚻 Restroom</div>
        <div class="stat-card-value" style="font-size:20px;color:${rColor}">${formatDuration(restroomMs)||"0s"}</div>
        <div class="stat-card-sub">${rSub}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">☕ 30 Min Break</div>
        <div class="stat-card-value" style="font-size:20px;color:${bColor}">${formatDuration(thirtyMinMs)||"0s"}</div>
        <div class="stat-card-sub">${bSub}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">🍽 Lunch</div>
        <div class="stat-card-value" style="font-size:20px;color:${lColor}">${formatDuration(lunchMs)||"0s"}</div>
        <div class="stat-card-sub">${lSub}</div>
      </div>
    </div>

    <div class="section-title">Status History</div>
    <div class="timeline" id="timeline"></div>

    <div class="lcu-section">
      <div class="section-title">Long Call Updates</div>
      <div class="lcu-list" id="lcuList"><div class="lcu-empty">No long call updates recorded</div></div>
    </div>

    <div class="lcu-section">
      <div class="section-title">Disconnected Call Updates</div>
      <div class="lcu-list" id="dcList"><div class="lcu-empty">No disconnected call updates recorded</div></div>
    </div>
  `;

  renderTimeline(history);
  renderCallList("lcuList", (agent.longCallUpdates||[]).filter(u => u.type === "longCall" || !u.type), "📞","⏱ LONG CALL UPDATE","background:#ef444415;border:1px solid #ef444433;color:#f87171");
  renderCallList("dcList",  (agent.longCallUpdates||[]).filter(u => u.type === "disconnected"),         "📵","📵 DISCONNECTED CALL","background:#f59e0b15;border:1px solid #f59e0b33;color:#fbbf24");

  // Live timer
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(() => {
    const el = document.getElementById("heroTimer");
    if (el) el.textContent = "for " + formatDuration(Date.now() - since);
  }, 1000);
}

function renderTimeline(history) {
  const tl = document.getElementById("timeline");
  if (!history.length) { tl.innerHTML = `<div style="color:#475569;font-size:12px;font-family:'DM Mono',monospace;padding:8px">No history yet</div>`; return; }
  tl.innerHTML = history.map((h, i) => {
    const color = getColor(h.status);
    const dur   = h.to ? formatDuration(h.to - h.from) : "—";
    const time  = new Date(h.from).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
    const hasParts = h.status?.includes(" — ");
    const label = hasParts ? h.status.split(" — ")[0] + " <span style='color:#64748b'>— " + escHtml(h.status.split(" — ").slice(1).join(" — ")) + "</span>" : escHtml(h.status||"Offline");
    const hasReason = h.reason;
    return `
      <div class="tl-row">
        <div class="tl-dot" style="background:${color}"></div>
        <div style="flex:1;min-width:0">
          <div class="tl-status">${label}</div>
          ${hasReason ? `
            <div class="tl-reason-toggle" data-idx="${i}">
              <span>Reason</span><span class="tl-arrow" id="tl-arr-${i}">▾</span>
            </div>
            <div class="tl-reason-body" id="tl-body-${i}">${escHtml(h.reason)}</div>` : ""}
        </div>
        <div style="text-align:right">
          <div class="tl-time">${time}</div>
          <div class="tl-dur">${dur}</div>
        </div>
      </div>`;
  }).join("");

  tl.querySelectorAll(".tl-reason-toggle").forEach(el => {
    el.addEventListener("click", function() {
      const idx   = this.dataset.idx;
      const body  = document.getElementById("tl-body-" + idx);
      const arrow = document.getElementById("tl-arr-"  + idx);
      body?.classList.toggle("open");
      arrow?.classList.toggle("open");
    });
  });
}

function renderCallList(listId, updates, icon, badgeLabel, badgeStyle) {
  const list = document.getElementById(listId);
  if (!list) return;
  if (!updates?.length) { list.innerHTML = `<div class="lcu-empty">No updates recorded</div>`; return; }
  list.innerHTML = updates.map((u, i) => {
    const uid  = listId + "-" + i;
    const time = new Date(u.timestamp).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
    const date = new Date(u.timestamp).toLocaleDateString([], {month:"short",day:"numeric"});
    return `
      <div class="lcu-row">
        <div class="lcu-row-header" data-uid="${uid}">
          <div class="lcu-icon">${icon}</div>
          <div class="lcu-row-info">
            <div class="lcu-case-num">${escHtml(u.caseNum||"No case number")}</div>
            <div class="lcu-meta">${date} · ${time} · ${escHtml(u.skillset||"")} · ${escHtml(u.team||"")}</div>
          </div>
          <div class="lcu-arrow" id="arr-${uid}">▾</div>
        </div>
        <div class="lcu-body" id="body-${uid}">
          <div class="lcu-badge" style="${badgeStyle}">${badgeLabel}</div>
          <div class="lcu-preview">${escHtml(u.preview||"")}</div>
        </div>
      </div>`;
  }).join("");

  list.querySelectorAll(".lcu-row-header").forEach(h => {
    h.addEventListener("click", function() {
      const uid = this.dataset.uid;
      document.getElementById("body-"+uid)?.classList.toggle("open");
      document.getElementById("arr-" +uid)?.classList.toggle("open");
    });
  });
}

// Init
loadAgents();
setInterval(loadAgents, 3000);
