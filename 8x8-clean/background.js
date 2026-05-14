// background.js

// ── Cloud sync config ────────────────────────────────────────────────────────
// After deploying to Vercel, fill these in OR set them at runtime via
// chrome.storage.local.set({ backendUrl, squadId, writeToken }).
const BACKEND_URL_DEFAULT = "";       // e.g. "https://your-app.vercel.app"
const SQUAD_ID_DEFAULT    = "";       // e.g. "trend-micro-bea"
const WRITE_TOKEN_DEFAULT = "";       // must match Vercel env SQUAD_WRITE_TOKEN

async function getSyncConfig() {
  const r = await chrome.storage.local.get(["backendUrl", "squadId", "writeToken"]);
  return {
    backendUrl: (r.backendUrl || BACKEND_URL_DEFAULT || "").replace(/\/+$/, ""),
    squadId:    r.squadId    || SQUAD_ID_DEFAULT,
    writeToken: r.writeToken || WRITE_TOKEN_DEFAULT,
  };
}

async function syncAgentToBackend(agents) {
  try {
    const cfg = await getSyncConfig();
    if (!cfg.backendUrl || !cfg.squadId || !cfg.writeToken) return;
    const me = await chrome.storage.local.get(["myAgentId", "myEmail"]);
    if (!me.myAgentId || !me.myEmail) return;
    const local = (agents || []).find(a => a.id === me.myAgentId);
    if (!local) return;
    const payload = {
      squadId: cfg.squadId,
      agent: {
        id: me.myEmail,                            // cross-squad identity
        name: local.name || me.myEmail.split("@")[0],
        status: local.status || "Offline",
        since: local.since || null,
        history: local.history || [],
        longCallUpdates: local.longCallUpdates || [],
        breakTotals: local.breakTotals || {},
      },
    };
    await fetch(cfg.backendUrl + "/api/status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + cfg.writeToken,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // Never let backend sync break local tracking
    console.warn("[8x8-tracker] backend sync failed:", e);
  }
}

const DEFAULT_AGENTS = [
  { id:"agent1", name:"Engineer 1", status:"Offline", since:null, history:[], longCallUpdates:[], breakTotals:{} },
  { id:"agent2", name:"Engineer 2", status:"Offline", since:null, history:[], longCallUpdates:[], breakTotals:{} },
  { id:"agent3", name:"Engineer 3", status:"Offline", since:null, history:[], longCallUpdates:[], breakTotals:{} },
  { id:"agent4", name:"Engineer 4", status:"Offline", since:null, history:[], longCallUpdates:[], breakTotals:{} }
];

chrome.runtime.onInstalled.addListener(async () => {
  const e = await chrome.storage.local.get("agents");
  if (!e.agents) await chrome.storage.local.set({ agents: DEFAULT_AGENTS });
  await chrome.storage.local.set({ lastUpdated: Date.now() });
});

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg.type === "STATUS_CHANGE" || msg.type === "MANUAL_STATUS") {
    handleStatusChange(msg.agentId, msg.status).then(respond); return true;
  }
  if (msg.type === "GET_AGENTS") {
    chrome.storage.local.get("agents").then(r => respond({ agents: r.agents || DEFAULT_AGENTS })); return true;
  }
  if (msg.type === "SET_AGENT_NAME") {
    updateAgentName(msg.agentId, msg.name).then(respond); return true;
  }
  if (msg.type === "GET_BREAK_TOTALS") {
    chrome.storage.local.get("agents").then(r => {
      const agent = (r.agents||DEFAULT_AGENTS).find(a => a.id === msg.agentId);
      respond({ breakTotals: agent?.breakTotals||{}, since: agent?.since, status: agent?.status });
    }); return true;
  }
  if (msg.type === "OPEN_POPUP_NOW") {
    try {
      chrome.action.openPopup();
    } catch(e) {
      chrome.tabs.query({ url: ["https://*.8x8.com/*"] }, tabs => {
        if (tabs[0]) chrome.windows.update(tabs[0].windowId, { focused: true }, () => {
          try { chrome.action.openPopup(); } catch(e2) {}
        });
      });
    }
    respond({ success: true }); return false;
  }

  if (msg.type === "LONG_CALL_DETECTED") {
    chrome.action.setBadgeText({ text: "⏱" });
    chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
    respond({ success: true }); return false;
  }

  if (msg.type === "LONG_CALL_UPDATE" || msg.type === "DISCONNECTED_CALL_UPDATE") {
    const type = msg.type === "LONG_CALL_UPDATE" ? "longCall" : "disconnected";
    saveLongCallUpdate(msg.agentId, msg.update, type).then(respond); return true;
  }
  if (msg.type === "PROMPT_REASON") {
    chrome.storage.local.set({ pendingReasonStatus: msg.status, pendingReasonAgentId: msg.agentId });
    try { chrome.action.openPopup(); } catch(e) {}
    respond({ success: true }); return false;
  }

});

async function handleStatusChange(agentId, status) {
  const r = await chrome.storage.local.get("agents");
  const agents = r.agents || DEFAULT_AGENTS;
  const idx = agents.findIndex(a => a.id === agentId);
  if (idx === -1) return { success: false };
  const agent = agents[idx];
  if (agent.status === status) return { success: true, unchanged: true };
  const now = Date.now();
  if (agent.since && agent.status) {
    const elapsed = now - agent.since;
    if (!agent.breakTotals) agent.breakTotals = {};
    if (agent.status === "On Break — Restroom")     agent.breakTotals.restroom  = (agent.breakTotals.restroom  || 0) + elapsed;
    if (agent.status === "On Break — 30 Min Break") agent.breakTotals.thirtyMin = (agent.breakTotals.thirtyMin || 0) + elapsed;
    if (agent.status === "On Break — Lunch")        agent.breakTotals.lunch     = (agent.breakTotals.lunch     || 0) + elapsed;
  }
  agent.history = [{ status: agent.status, from: agent.since || now, to: now }, ...(agent.history||[])].slice(0, 50);
  agent.status = status;
  agent.since = now;
  if (!agent.longCallUpdates) agent.longCallUpdates = [];
  if (!agent.breakTotals) agent.breakTotals = {};
  agents[idx] = agent;
  await chrome.storage.local.set({ agents, lastUpdated: now });
  pushToDashboard(agents, now);
  syncAgentToBackend(agents);
  return { success: true };
}

async function saveLongCallUpdate(agentId, update, type) {
  if (type === "longCall") {
    try { chrome.action.setBadgeText({ text: "" }); } catch(e) {}
  }
  const r = await chrome.storage.local.get("agents");
  const agents = r.agents || DEFAULT_AGENTS;
  const idx = agents.findIndex(a => a.id === agentId);
  if (idx === -1) return { success: false };
  if (!agents[idx].longCallUpdates) agents[idx].longCallUpdates = [];
  agents[idx].longCallUpdates.unshift({ ...update, type, timestamp: Date.now() });
  agents[idx].longCallUpdates = agents[idx].longCallUpdates.slice(0, 20);
  const now = Date.now();
  await chrome.storage.local.set({ agents, lastUpdated: now });
  pushToDashboard(agents, now);
  syncAgentToBackend(agents);
  return { success: true };
}

async function updateAgentName(agentId, name) {
  const r = await chrome.storage.local.get("agents");
  const agents = r.agents || DEFAULT_AGENTS;
  const idx = agents.findIndex(a => a.id === agentId);
  if (idx === -1) return { success: false };
  agents[idx].name = name;
  await chrome.storage.local.set({ agents, lastUpdated: Date.now() });
  return { success: true };
}

function pushToDashboard(agents, now) {
  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
      if (tab.url?.includes("dashboard.html"))
        chrome.tabs.sendMessage(tab.id, { type:"AGENTS_UPDATED", agents, lastUpdated: now }).catch(()=>{});
    });
  });
}
