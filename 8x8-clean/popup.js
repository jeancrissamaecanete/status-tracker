// popup.js

function getColor(s) {
  if (!s) return "#6b7280";
  const t = s.toLowerCase();
  if (t === "available") return "#22c55e";
  if (t === "on call") return "#3b82f6";
  if (t.startsWith("on break") || t.startsWith("break")) return "#f59e0b";
  if (t.startsWith("work offline")) return "#8b5cf6";
  return "#6b7280";
}

function fmtMs(ms) {
  const m = Math.floor(ms/60000), s = Math.floor((ms%60000)/1000);
  return m > 0 ? m+"m "+s+"s" : s+"s";
}

function fmtClock(ms) {
  if (!ms || ms < 0) return "00:00";
  const s = Math.floor(ms/1000), m = Math.floor(s/60), h = Math.floor(m/60);
  const mm = String(m%60).padStart(2,"0"), ss = String(s%60).padStart(2,"0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function getNameFromEmail(email) {
  const local = email.split("@")[0] || email;
  return local.split(/[._-]/).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function assignSlot(email) {
  let hash = 0;
  for (const ch of email) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return "agent" + ((Math.abs(hash) % 4) + 1);
}

let myAgentId = null;
let pendingStatus = null;

function toast(msg) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg; el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2500);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    if (!myAgentId && btn.dataset.tab !== "identity") {
      toast("Please sign in first");
      const idTab = document.querySelector('[data-tab="identity"]');
      if (idTab) { idTab.style.color = "#f87171"; setTimeout(() => idTab.style.color = "", 1000); }
      return;
    }
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-"+btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "break") startBreakTimer();
    else stopBreakTimer();
  });
});

// ── Status badge ──────────────────────────────────────────────────────────────
function setDetected(status) {
  const dot = document.getElementById("detDot");
  const txt = document.getElementById("detTxt");
  if (dot) dot.style.background = getColor(status);
  if (txt) txt.textContent = status || "Not detected";
}

// ── Sign In / Sign Out ────────────────────────────────────────────────────────
function showLoginView() {
  const lv = document.getElementById("loginView");
  const pv = document.getElementById("profileView");
  if (lv) lv.style.display = "block";
  if (pv) pv.style.display = "none";
  const ei = document.getElementById("emailInput");
  const se = document.getElementById("signInError");
  if (ei) ei.value = "";
  if (se) se.style.display = "none";
}

function showProfileView(email, nameOverride) {
  const name = nameOverride || getNameFromEmail(email);
  const lv = document.getElementById("loginView");
  const pv = document.getElementById("profileView");
  if (lv) lv.style.display = "none";
  if (pv) pv.style.display = "block";
  const pn = document.getElementById("profileName");
  const pe = document.getElementById("profileEmail");
  const pa = document.getElementById("profileAvatar");
  if (pn) pn.textContent = name;
  if (pe) pe.textContent = email;
  if (pa) pa.textContent = name.charAt(0).toUpperCase();
}

function forceIdentityTab() {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  const btn = document.querySelector('[data-tab="identity"]');
  const pan = document.getElementById("tab-identity");
  if (btn) btn.classList.add("active");
  if (pan) pan.classList.add("active");
}

const signInBtn = document.getElementById("signInBtn");
if (signInBtn) {
  signInBtn.onclick = () => {
    const emailEl = document.getElementById("emailInput");
    const errEl   = document.getElementById("signInError");
    if (!emailEl || !errEl) return;
    const email = emailEl.value.trim().toLowerCase();
    errEl.style.display = "none";
    if (!email) { errEl.textContent = "Please enter your work email."; errEl.style.display = "block"; return; }
    if (!/^[^\s@]+@trendmicro\.com$/.test(email)) { errEl.textContent = "Only @trendmicro.com accounts are allowed."; errEl.style.display = "block"; return; }
    const slot = assignSlot(email);
    const name = getNameFromEmail(email);
    myAgentId = slot;
    chrome.storage.local.set({ myAgentId: slot, myEmail: email });
    chrome.runtime.sendMessage({ type:"SET_AGENT_NAME", agentId: slot, name }, () => {
      showProfileView(email, name);
      toast("Signed in as " + name);
      chrome.tabs.query({}, tabs => {
        tabs.forEach(tab => {
          if (tab.url?.includes("8x8.com"))
            chrome.tabs.sendMessage(tab.id, { type:"UPDATE_AGENT_ID", agentId: slot }).catch(()=>{});
        });
      });
    });
  };
}

const emailInput = document.getElementById("emailInput");
if (emailInput) {
  emailInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && signInBtn) signInBtn.click();
  });
}

const signOutBtn = document.getElementById("signOutBtn");
if (signOutBtn) {
  signOutBtn.onclick = () => {
    chrome.storage.local.remove(["myAgentId","myEmail"]);
    myAgentId = null;
    showLoginView();
    forceIdentityTab();
    toast("Signed out");
  };
}

// ── Load state ────────────────────────────────────────────────────────────────
function loadState() {
  chrome.storage.local.get(["myAgentId","myEmail","agents","pendingLongCall","pendingLongCallDuration","lcuSiebelId","lcuTeam","lcuSkillset"], r => {
    if (!r.myEmail || !r.myAgentId) {
      myAgentId = null;
      forceIdentityTab();
      showLoginView();
      return;
    }
    myAgentId = r.myAgentId;
    showProfileView(r.myEmail);
    const eng = (r.agents||[]).find(a => a.id === myAgentId);
    if (eng) setDetected(eng.status);
    if (r.lcuSiebelId) { const el = document.getElementById("lcuSiebelId"); if(el) el.value = r.lcuSiebelId; }
    if (r.lcuTeam)     { const el = document.getElementById("lcuTeam");     if(el) el.value = r.lcuTeam; }
    if (r.lcuSkillset) { const el = document.getElementById("lcuSkillset"); if(el) el.value = r.lcuSkillset; }
    if (r.pendingLongCall) {
      chrome.storage.local.remove(["pendingLongCall","pendingLongCallAgentId","pendingLongCallDuration"]);
      try { chrome.action.setBadgeText({ text: "" }); } catch(e) {}
      switchToCallUpdate();
      playTing();
      setTimeout(() => document.getElementById("lcuCaseNum")?.focus(), 200);
    }
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
const dashBtn = document.getElementById("dashBtn");
if (dashBtn) dashBtn.onclick = () => chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });

// ── Profile save ──────────────────────────────────────────────────────────────
const saveProfileBtn = document.getElementById("saveProfileBtn");
if (saveProfileBtn) {
  saveProfileBtn.onclick = () => {
    chrome.storage.local.set({
      lcuSiebelId: document.getElementById("lcuSiebelId")?.value.trim() || "",
      lcuTeam:     document.getElementById("lcuTeam")?.value.trim()     || "",
      lcuSkillset: document.getElementById("lcuSkillset")?.value.trim() || ""
    });
    toast("Profile saved!");
  };
}

// ── Call Update helpers ───────────────────────────────────────────────────────
function switchToCallUpdate() {
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  const btn = document.querySelector('[data-tab="callupdate"]');
  const pan = document.getElementById("tab-callupdate");
  if (btn) btn.classList.add("active");
  if (pan) pan.classList.add("active");
  const lcu = document.getElementById("lcuFormSection");
  const dc  = document.getElementById("dcFormSection");
  if (lcu) lcu.style.display = "block";
  if (dc)  dc.style.display  = "none";
}

const showLcuBtn = document.getElementById("showLcuBtn");
if (showLcuBtn) showLcuBtn.onclick = () => {
  const lcu = document.getElementById("lcuFormSection");
  const dc  = document.getElementById("dcFormSection");
  const dcp = document.getElementById("dcPreviewSection");
  if (lcu) lcu.style.display = "block";
  if (dc)  dc.style.display  = "none";
  if (dcp) dcp.style.display = "none";
};

const hideLcuBtn = document.getElementById("hideLcuBtn");
if (hideLcuBtn) hideLcuBtn.onclick = () => {
  const lcu = document.getElementById("lcuFormSection");
  const lp  = document.getElementById("lcuPreviewSection");
  if (lcu) lcu.style.display = "none";
  if (lp)  lp.style.display  = "none";
};

const showDcBtn = document.getElementById("showDcBtn");
if (showDcBtn) showDcBtn.onclick = () => {
  const dc  = document.getElementById("dcFormSection");
  const lcu = document.getElementById("lcuFormSection");
  const lp  = document.getElementById("lcuPreviewSection");
  if (dc)  dc.style.display  = "block";
  if (lcu) lcu.style.display = "none";
  if (lp)  lp.style.display  = "none";
};

const hideDcBtn = document.getElementById("hideDcBtn");
if (hideDcBtn) hideDcBtn.onclick = () => {
  const dc  = document.getElementById("dcFormSection");
  const dcp = document.getElementById("dcPreviewSection");
  if (dc)  dc.style.display  = "none";
  if (dcp) dcp.style.display = "none";
};

// ── Preview builder ───────────────────────────────────────────────────────────
function buildPreview(header, cn, is, re) {
  const sid = document.getElementById("lcuSiebelId")?.value.trim() || "—";
  const tm  = document.getElementById("lcuTeam")?.value.trim()     || "—";
  const sk  = document.getElementById("lcuSkillset")?.value.trim() || "—";
  const c   = document.getElementById(cn)?.value.trim() || "—";
  const i   = document.getElementById(is)?.value.trim() || "—";
  const r   = document.getElementById(re)?.value.trim() || "—";
  return { sid, tm, sk, c, i, r,
    preview: `${header}\nSIEBEL ID: ${sid}\nTEAM: ${tm}\nSKILLSET: ${sk}\nCASE NUMBER: ${c}\nISSUE: ${i}\nREASON: ${r}` };
}

["lcuCaseNum","lcuIssue","lcuReason"].forEach(id => {
  document.getElementById(id)?.addEventListener("input", () => {
    const d = buildPreview("LONG CALL UPDATE","lcuCaseNum","lcuIssue","lcuReason");
    const el = document.getElementById("lcuPreview");
    const ps = document.getElementById("lcuPreviewSection");
    if (el) el.textContent = d.preview;
    if (ps) ps.style.display = "block";
  });
});

["dcCaseNum","dcIssue","dcReason"].forEach(id => {
  document.getElementById(id)?.addEventListener("input", () => {
    const d = buildPreview("DISCONNECTED CALL","dcCaseNum","dcIssue","dcReason");
    const el = document.getElementById("dcPreview");
    const ps = document.getElementById("dcPreviewSection");
    if (el) el.textContent = d.preview;
    if (ps) ps.style.display = "block";
  });
});

const submitLcuBtn = document.getElementById("submitLcuBtn");
if (submitLcuBtn) submitLcuBtn.onclick = () => {
  const d = buildPreview("LONG CALL UPDATE","lcuCaseNum","lcuIssue","lcuReason");
  if (d.c === "—" && d.i === "—") { toast("Fill in Case Number or Issue"); return; }
  chrome.runtime.sendMessage({ type:"LONG_CALL_UPDATE", agentId:myAgentId, update:{ siebelId:d.sid, team:d.tm, skillset:d.sk, caseNum:d.c, issue:d.i, reason:d.r, preview:d.preview } }, () => {
    toast("Long call update submitted!");
    ["lcuCaseNum","lcuIssue","lcuReason"].forEach(id => { const el = document.getElementById(id); if(el) el.value=""; });
    const ps = document.getElementById("lcuPreviewSection"); if(ps) ps.style.display="none";
    const fs = document.getElementById("lcuFormSection");    if(fs) fs.style.display="none";
  });
};

const submitDcBtn = document.getElementById("submitDcBtn");
if (submitDcBtn) submitDcBtn.onclick = () => {
  const d = buildPreview("DISCONNECTED CALL","dcCaseNum","dcIssue","dcReason");
  if (d.c === "—" && d.i === "—") { toast("Fill in Case Number or Issue"); return; }
  chrome.runtime.sendMessage({ type:"DISCONNECTED_CALL_UPDATE", agentId:myAgentId, update:{ siebelId:d.sid, team:d.tm, skillset:d.sk, caseNum:d.c, issue:d.i, reason:d.r, preview:d.preview } }, () => {
    toast("Disconnected call update submitted!");
    ["dcCaseNum","dcIssue","dcReason"].forEach(id => { const el = document.getElementById(id); if(el) el.value=""; });
    const ps = document.getElementById("dcPreviewSection"); if(ps) ps.style.display="none";
    const fs = document.getElementById("dcFormSection");    if(fs) fs.style.display="none";
  });
};

// ── Sound ─────────────────────────────────────────────────────────────────────
function playTing() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.8);
    osc.onended = () => ctx.close();
  } catch(e) {}
}

// ── Break Timer ───────────────────────────────────────────────────────────────
const BREAK_LIMITS_TIMER = {
  "On Break — Restroom":      { limitMs: 15*60*1000, icon:"🚻", label:"Restroom" },
  "On Break — 30 Min Break":  { limitMs: 30*60*1000, icon:"☕", label:"30 Min Break" },
  "On Break — Lunch":         { limitMs: 60*60*1000, icon:"🍽", label:"Lunch" },
  "On Break — Personal Break":{ limitMs: 30*60*1000, icon:"🧘", label:"Personal Break" },
};
let bkInterval = null;

function renderBreakTimer() {
  chrome.storage.local.get(["agents","myAgentId"], r => {
    const agId   = r.myAgentId || myAgentId || "agent1";
    const agents = r.agents || [];
    const agent  = agents.find(a => a.id === agId);
    const status = agent?.status || "";
    const since  = agent?.since  || null;
    const now    = Date.now();
    const card   = document.getElementById("bkCurrentCard");
    const rule   = BREAK_LIMITS_TIMER[status];
    if (!card) return;
    if (rule && since) {
      const elapsed = now - since;
      const pct   = Math.min(elapsed / rule.limitMs * 100, 100);
      const over  = elapsed > rule.limitMs;
      const color = over ? "#ef4444" : elapsed/rule.limitMs > 0.8 ? "#f59e0b" : "#22c55e";
      const remain = rule.limitMs - elapsed;
      card.innerHTML = `
        <div class="bk-status-row">
          <div class="bk-status-dot" style="background:${color}"></div>
          <div class="bk-status-label" style="color:${color}">${rule.label}</div>
          ${over ? '<span class="bk-overdue-badge">OVERDUE</span>' : ""}
        </div>
        <div class="bk-elapsed-num" style="color:${color}">${fmtClock(elapsed)}</div>
        <div class="bk-bar-wrap"><div class="bk-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="bk-remain-row">
          <div class="bk-remain-txt" style="color:${color}">${over ? "+"+fmtClock(elapsed-rule.limitMs)+" over" : fmtClock(remain)+" left"}</div>
          <div class="bk-limit-txt">limit: ${fmtClock(rule.limitMs)}</div>
        </div>`;
    } else {
      card.innerHTML = `<div class="bk-not-on">Not currently on break</div>`;
    }
    const budget = document.getElementById("bkBudget");
    if (!budget) return;
    const history = agent?.history || [];
    const totals = { restroom:0, "30min":0, lunch:0, personal:0 };
    for (const h of history) {
      const dur = (h.to && h.from) ? h.to - h.from : 0;
      if (h.status?.includes("Restroom"))     totals.restroom  += dur;
      if (h.status?.includes("30 Min Break")) totals["30min"]  += dur;
      if (h.status?.includes("Lunch"))        totals.lunch     += dur;
      if (h.status?.includes("Personal"))     totals.personal  += dur;
    }
    if (rule && since) {
      const el = now - since;
      if (status.includes("Restroom"))     totals.restroom  += el;
      if (status.includes("30 Min Break")) totals["30min"]  += el;
      if (status.includes("Lunch"))        totals.lunch     += el;
      if (status.includes("Personal"))     totals.personal  += el;
    }
    const rows = [
      { icon:"🚻", label:"Restroom",      used:totals.restroom,  limitMs:15*60*1000 },
      { icon:"☕", label:"30 Min Break",   used:totals["30min"],  limitMs:30*60*1000 },
      { icon:"🍽", label:"Lunch",          used:totals.lunch,     limitMs:60*60*1000 },
      { icon:"🧘", label:"Personal Break", used:totals.personal,  limitMs:30*60*1000 },
    ];
    budget.innerHTML = rows.map(row => {
      const pct   = Math.min(row.used/row.limitMs*100, 100);
      const over  = row.used > row.limitMs;
      const color = over ? "#ef4444" : row.used/row.limitMs > 0.8 ? "#f59e0b" : "#22c55e";
      return `<div class="bk-budget-row">
        <div class="bk-budget-icon">${row.icon}</div>
        <div class="bk-budget-info">
          <div class="bk-budget-label">${row.label}</div>
          <div class="bk-budget-bar-wrap"><div class="bk-budget-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        </div>
        <div class="bk-budget-time" style="color:${color}">
          ${fmtClock(row.used)}${over?'<span class="bk-overdue-badge">!</span>':""}
          <span style="color:#334155;font-weight:400"> / ${fmtClock(row.limitMs)}</span>
        </div>
      </div>`;
    }).join("");
  });
}

function startBreakTimer() {
  if (bkInterval) clearInterval(bkInterval);
  renderBreakTimer();
  bkInterval = setInterval(renderBreakTimer, 1000);
}
function stopBreakTimer() {
  if (bkInterval) { clearInterval(bkInterval); bkInterval = null; }
}

// ── Live listeners ────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener(msg => {
  if (msg.type === "LONG_CALL_DETECTED" && (!msg.agentId || msg.agentId === myAgentId)) {
    chrome.storage.local.remove(["pendingLongCall","pendingLongCallAgentId","pendingLongCallDuration"]);
    try { chrome.action.setBadgeText({ text: "" }); } catch(e) {}
    switchToCallUpdate();
    playTing();
    setTimeout(() => document.getElementById("lcuCaseNum")?.focus(), 200);
  }
  if (msg.type === "AGENTS_UPDATED" && msg.agents) {
    const me = msg.agents.find(a => a.id === myAgentId);
    if (me) setDetected(me.status);
  }
});

// Poll every 2s to keep badge in sync
setInterval(() => {
  if (!myAgentId) return;
  chrome.storage.local.get("agents", r => {
    const me = (r.agents||[]).find(a => a.id === myAgentId);
    if (me) setDetected(me.status);
  });
}, 2000);

// ── Init ──────────────────────────────────────────────────────────────────────
loadState();
