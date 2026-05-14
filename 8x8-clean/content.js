// content.js
(function () {
  "use strict";

  const REASON_REQUIRED = new Set([
    "Work Offline — Callback","Work Offline — Case Management","Work Offline — Training",
    "Work Offline — Meeting","Work Offline — Special Task","Work Offline — Production Task",
    "Work Offline — Remote Access On Chat","Work Offline — System Issues"
  ]);

  const BREAK_SUBS = ["lunch","30 min break","30min break","30-min break","personal break","restroom"];
  const WO_SUBS = [
    "remote access on chat","chat session ongoing","online idle","callback","email",
    "case management","training","meeting","special task","system issues","production task",
    "scs chat online","scs task","swarming","opex","people development","case handling"
  ];
  const CALL_KW = ["on a call","on call","in call","active call","ringing","connected","talking","dialing","inbound call","outbound call"];

  const CALL_SELS = [
    '[class*="hangup"],[class*="hang-up"],[class*="HangUp"],[class*="endCall"],[class*="end-call"]',
    '[class*="holdBtn"],[class*="HoldButton"],[aria-label*="hang up" i],[aria-label*="end call" i]',
    '[class*="callTimer"],[class*="call-timer"],[class*="callDuration"],[class*="activeCall"]',
    '[class*="inCall"],[class*="onCall"],[aria-label*="mute" i]'
  ].join(",");

  function toTitle(s) { return s.replace(/\b\w/g, c => c.toUpperCase()); }

  function matchStatus(raw) {
    if (!raw) return null;
    const t = raw.toLowerCase().trim();
    if (!t || t.length < 3 || t.length > 80 || /^[\d:\s\/]+$/.test(t)) return null;
    for (const kw of CALL_KW) { if (t === kw || t.includes(kw)) return "On Call"; }
    for (const s of BREAK_SUBS) { if (t === s || t.includes(s)) return "On Break — " + toTitle(s); }
    for (const s of WO_SUBS)    { if (t === s || t.includes(s)) return "Work Offline — " + toTitle(s); }
    if (["available","ready to work","ready"].includes(t)) return "Available";
    if (t.includes("work offline")) return "Work Offline";
    if (t === "on break" || t.startsWith("on break") || t === "break") return "On Break";
    if (t.includes("available")) return "Available";
    if (t.includes("break")) return "On Break";
    if (t.includes("offline")) return "Work Offline";
    return null;
  }

  let currentStatus = null;
  let agentId = "agent1";
  let longCallAlertSent = false;
  const LONG_CALL_MS = 3 * 60 * 1000; // 3 min for testing — change to 25 for production



  function getAllDocs() {
    const docs = [document];
    document.querySelectorAll("iframe").forEach(f => {
      try { const d = f.contentDocument || f.contentWindow?.document; if (d?.body) docs.push(d); } catch(e) {}
    });
    return docs;
  }

  function isOnActiveCall(docs) {
    for (const doc of docs) {
      try {
        const el = doc.querySelector(CALL_SELS);
        if (el) { const r = el.getBoundingClientRect(); if (r.width > 0 || r.height > 0) return true; }
        const txt = (doc.body?.innerText || "").toLowerCase();
        if ((txt.includes("inbound") || txt.includes("outbound")) && /\d+m\s+\d+s/.test(txt)) return true;
      } catch(e) {}
    }
    return false;
  }

  function findCallTimer(docs) {
    for (const doc of docs) {
      try {
        for (const el of doc.querySelectorAll("span,div,p")) {
          if (el.children.length > 0) continue;
          const t = (el.textContent||"").trim();
          if (/^\d+m\s+\d{1,2}s$/.test(t) || /^\d+h\s+\d+m/.test(t)) return t;
        }
      } catch(e) {}
    }
    return null;
  }

  function parseMs(text) {
    if (!text) return null;
    const t = text.toLowerCase();
    let ms = 0;
    const h = t.match(/(\d+)\s*h/), m = t.match(/(\d+)\s*m/), s = t.match(/(\d+)\s*s/);
    if (h) ms += +h[1] * 3600000;
    if (m) ms += +m[1] * 60000;
    if (s) ms += +s[1] * 1000;
    return ms > 0 ? ms : null;
  }

  function checkLongCall(docs) {
    // Only trigger long call alert if current status is explicitly "On Call"
    // This prevents false positives from Work Offline sub-statuses with timers
    if (currentStatus !== "On Call") {
      longCallAlertSent = false;
      return;
    }

    const txt = findCallTimer(docs);
    if (!txt) return;

    // Reset alert if timer resets (new call started — timer drops below 1 min)
    const ms = parseMs(txt);
    if (!ms) return;
    if (ms < 60000) { longCallAlertSent = false; return; }

    if (ms >= LONG_CALL_MS && !longCallAlertSent) {
      longCallAlertSent = true;
      // Store pending flag
      chrome.storage.local.set({
        pendingLongCall: true,
        pendingLongCallAgentId: agentId,
        pendingLongCallDuration: ms
      });
      // Show corner notification with sound — user clicks it to open extension
      showLongCallNotification(ms);
    }
  }

  function handleDetected(status) {
    if (!status || status === currentStatus) return;
    currentStatus = status;
    if (REASON_REQUIRED.has(status)) {
      chrome.runtime.sendMessage({ type:"PROMPT_REASON", agentId, status });
    } else {
      chrome.runtime.sendMessage({ type:"STATUS_CHANGE", agentId, status });
    }
  }

  function scanCallState(docs) {
    for (const doc of docs) {
      try {
        const el = doc.querySelector(CALL_SELS);
        if (el) { const r = el.getBoundingClientRect(); if (r.width > 0 || r.height > 0) return "On Call"; }
        const txt = (doc.body?.innerText||"").toLowerCase();
        if ((txt.includes("inbound")||txt.includes("outbound")) && /\d+m\s+\d+s/.test(txt)) return "On Call";
        for (const el of doc.querySelectorAll("span,div,p,label")) {
          if (el.children.length > 0) continue;
          const t = (el.textContent||"").trim().toLowerCase();
          if (!t || t.length < 3 || t.length > 60) continue;
          for (const kw of CALL_KW) { if (t === kw || t.includes(kw)) return "On Call"; }
          if (["ringing","connected","talking","dialing","alerting"].includes(t)) return "On Call";
        }
      } catch(e) {}
    }
    return null;
  }

  function scanLeafNodes(doc) {
    try {
      // Priority 1: Look for elements explicitly marked as selected/active
      const activeSels = [
        '[aria-checked="true"]', '[aria-selected="true"]',
        '[aria-current="true"]', '[data-selected="true"]',
        '[class*="selected"]', '[class*="--active"]',
        '[class*="_active"]', '[class*="is-active"]',
        '[class*="isCurrent"]', '[class*="current"]'
      ];
      for (const sel of activeSels) {
        try {
          for (const el of doc.querySelectorAll(sel)) {
            const txt = (el.textContent||"").trim().replace(/[✓✔☑⊙]/g, "").trim();
            if (!txt || txt.length < 3 || txt.length > 80) continue;
            const s = matchStatus(txt);
            if (s) return s;
          }
        } catch(e) {}
      }

      // Priority 2: Look for checkmark SVG siblings — the selected item has one
      // In React UIs, a checkmark SVG is placed next to the active status label
      try {
        for (const svg of doc.querySelectorAll("svg")) {
          const r = svg.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          // Look at siblings and parent for status text
          const parent = svg.parentElement;
          if (!parent) continue;
          const txt = (parent.textContent||"").trim().replace(/[✓✔☑⊙]/g, "").trim();
          if (txt && txt.length >= 3 && txt.length <= 80) {
            const s = matchStatus(txt);
            if (s) return s;
          }
          // Check adjacent text nodes
          const prev = svg.previousElementSibling;
          const next = svg.nextElementSibling;
          for (const sib of [prev, next]) {
            if (!sib) continue;
            const t = (sib.textContent||"").trim();
            if (t && t.length >= 3 && t.length <= 80) {
              const s = matchStatus(t);
              if (s) return s;
            }
          }
        }
      } catch(e) {}

      // Priority 3: Scan leaf nodes but skip sub-items
      // Sub-items are indented children — their grandparent contains the group header
      // (e.g., "Break" or "Work Offline")
      // We detect this by checking if any ancestor within 4 levels
      // has text matching a TOP-LEVEL status group name
      const GROUP_HEADERS = ["break", "work offline", "offline"];

      let best = null, bestScore = 0;
      for (const el of doc.querySelectorAll("span,div,p,h1,h2,h3,h4,h5,label,button,td")) {
        if (el.children.length > 0) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        const txt = (el.textContent||"").trim();
        if (!txt || txt.length < 3 || txt.length > 80 || /^[\d:\s\/]+$/.test(txt)) continue;

        const s = matchStatus(txt);
        if (!s) continue;

        // Skip sub-status items: check if any ancestor (up to 6 levels)
        // contains ONLY a group header name — meaning this el is a child option
        let isSubItem = false;
        let p = el.parentElement;
        let depth = 0;
        while (p && depth < 6) {
          const siblings = Array.from(p.children).filter(c => {
            const t = (c.textContent||"").trim().toLowerCase();
            return t.length > 2 && t.length < 30;
          });
          // If this container has 3+ children that match sub-statuses, it's a list
          const subCount = siblings.filter(c => {
            const t = (c.textContent||"").trim();
            return t.length > 2 && matchStatus(t) && matchStatus(t)?.includes(" — ");
          }).length;
          if (subCount >= 2) { isSubItem = true; break; }
          p = p.parentElement;
          depth++;
        }
        if (isSubItem) continue;

        const score = s.includes(" — ") ? 2 : 1;
        if (score > bestScore) { best = s; bestScore = score; }
      }
      return best;
    } catch(e) { return null; }
  }

  function scanAttrs(doc) {
    try {
      for (const el of doc.querySelectorAll("[aria-label],[title],[data-status],[data-state]")) {
        for (const attr of ["aria-label","title","data-status","data-state"]) {
          const s = matchStatus(el.getAttribute(attr)||"");
          if (s) return s;
        }
      }
    } catch(e) {}
    return null;
  }

  function scanInnerText(doc) {
    // Skip innerText scan entirely — too broad, picks up dropdown menu items
    // scanLeafNodes with menu filtering is sufficient
    return null;
  }

  function scanForStatus() {
    const docs = getAllDocs();
    // Detect call state first so currentStatus is up to date
    const call = scanCallState(docs);
    if (call) { handleDetected(call); }
    else {
      for (const doc of docs) {
        const s = scanLeafNodes(doc) || scanAttrs(doc) || scanInnerText(doc);
        if (s) { handleDetected(s); break; }
      }
    }
    // Now check long call AFTER currentStatus has been updated
    checkLongCall(docs);
  }

  function observeIframe(iframe) {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc?.body) return;
      let d;
      new MutationObserver(() => { clearTimeout(d); d = setTimeout(scanForStatus, 250); })
        .observe(doc.body, { childList:true, subtree:true, characterData:true, attributes:true });
    } catch(e) {}
  }

  function startObservers() {
    let d;
    new MutationObserver(() => { clearTimeout(d); d = setTimeout(scanForStatus, 200); })
      .observe(document.body, { childList:true, subtree:true, characterData:true, attributes:true });
    document.querySelectorAll("iframe").forEach(observeIframe);

    // Watch for new iframes being added dynamically (8x8 may lazy-load frames)
    new MutationObserver(mutations => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.tagName === "IFRAME") {
            setTimeout(() => { observeIframe(node); scanForStatus(); }, 1000);
          }
        }
      }
    }).observe(document.body, { childList:true, subtree:true });

    // control_frame specifically — re-observe on every load
    const cf = document.getElementById("control_frame");
    if (cf) {
      cf.addEventListener("load", () => {
        setTimeout(() => { observeIframe(cf); scanForStatus(); }, 500);
        setTimeout(scanForStatus, 1500);
        setTimeout(scanForStatus, 3000);
      });
    }
  }


  


  // ── Long Call Corner Notification ────────────────────────────────────────
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
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.8);
      osc.onended = () => ctx.close();
    } catch(e) {}
  }

  function showLongCallNotification(durationMs) {
    const existing = document.getElementById("_8x8t_notif");
    if (existing) existing.remove();

    const mins = Math.floor((durationMs || 0) / 60000);

    if (!document.getElementById("_8x8t_css")) {
      const s = document.createElement("style");
      s.id = "_8x8t_css";
      s.textContent = `
        #_8x8t_notif {
          position: fixed; bottom: 24px; right: 24px;
          width: 320px; background: #0d0f14;
          border: 1px solid #ef444466;
          border-top: 3px solid #ef4444;
          border-radius: 16px;
          box-shadow: 0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(239,68,68,0.15);
          z-index: 2147483647; font-family: system-ui, -apple-system, sans-serif;
          animation: _8x8t_in 0.4s cubic-bezier(0.16,1,0.3,1);
          overflow: hidden;
        }
        @keyframes _8x8t_in {
          from { transform: translateY(120%) scale(0.95); opacity: 0; }
          to   { transform: translateY(0) scale(1); opacity: 1; }
        }
        #_8x8t_notif * { box-sizing:border-box; margin:0; padding:0; }

        ._8x8t_h {
          background: linear-gradient(135deg, rgba(239,68,68,0.18), rgba(239,68,68,0.06));
          padding: 14px 16px 12px;
          display: flex; align-items: center; gap: 10px;
          border-bottom: 1px solid rgba(239,68,68,0.15);
        }
        ._8x8t_icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; flex-shrink: 0;
        }
        ._8x8t_hinfo { flex: 1; min-width: 0; }
        ._8x8t_t { font-size: 13px; font-weight: 700; color: #f87171; letter-spacing: -0.01em; }
        ._8x8t_sub { font-size: 11px; color: #64748b; margin-top: 2px; font-family: monospace; }

        ._8x8t_p {
          width: 8px; height: 8px; border-radius: 50%; background: #ef4444;
          flex-shrink: 0; animation: _8x8t_b 1s infinite; box-shadow: 0 0 6px #ef4444;
        }
        @keyframes _8x8t_b { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(0.85)} }

        ._8x8t_body { padding: 12px 16px; }
        ._8x8t_msg {
          font-size: 12px; color: #94a3b8; line-height: 1.6;
          background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.12);
          border-radius: 8px; padding: 10px 12px; margin-bottom: 12px;
        }
        ._8x8t_msg strong { color: #fca5a5; font-weight: 600; }

        ._8x8t_btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; padding: 11px 16px;
          background: linear-gradient(135deg, #ef4444, #dc2626);
          color: white; border: none; border-radius: 10px;
          font-size: 13px; font-weight: 700; cursor: pointer;
          font-family: system-ui, sans-serif;
          box-shadow: 0 4px 12px rgba(239,68,68,0.4);
          transition: all 0.15s ease;
          letter-spacing: 0.01em;
        }
        ._8x8t_btn:hover {
          background: linear-gradient(135deg, #f87171, #ef4444);
          box-shadow: 0 6px 16px rgba(239,68,68,0.5);
          transform: translateY(-1px);
        }
        ._8x8t_btn:active { transform: translateY(0); }

        ._8x8t_footer {
          padding: 8px 16px 12px;
          font-size: 10px; color: #334155; text-align: center;
          letter-spacing: 0.02em; text-transform: uppercase;
        }
      `;
      document.head.appendChild(s);
    }

    const notif = document.createElement("div");
    notif.id = "_8x8t_notif";
    notif.innerHTML = `
      <div class="_8x8t_h">
        <div class="_8x8t_icon">⏱</div>
        <div class="_8x8t_hinfo">
          <div class="_8x8t_t">Long Call Alert</div>
          <div class="_8x8t_sub">${mins}m ${Math.floor(((durationMs||0)%60000)/1000)}s on call</div>
        </div>
        <div class="_8x8t_p"></div>
      </div>
      <div class="_8x8t_body">
        <div class="_8x8t_msg">
          Your call has been running for <strong>${mins} minute${mins!==1?"s":""}</strong>.
          A Long Call Update is required.
        </div>
        <button class="_8x8t_btn" id="_8x8t_btn">
          📞 Open Long Call Update
        </button>
      </div>
      <div class="_8x8t_footer">8x8 Status Tracker · Click to open extension</div>
    `;
    document.body.appendChild(notif);
    playTing();

    // Clicking the button is a user gesture — openPopup() will work from here
    document.getElementById("_8x8t_btn").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_POPUP_NOW" });
      // Also send the detected message so popup knows to switch tab
      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: "LONG_CALL_DETECTED",
          agentId,
          durationMs
        });
      }, 400);
    });

    // Auto-remove once pendingLongCall is cleared
    const watcher = setInterval(() => {
      chrome.storage.local.get("pendingLongCall", r => {
        if (!r.pendingLongCall) {
          notif.remove();
          clearInterval(watcher);
        }
      });
    }, 2000);
  }

  async function init() {
    const r = await chrome.storage.local.get("myAgentId");
    agentId = r.myAgentId || "agent1";
    // Keep agentId fresh — re-read every 5s in case user signs in after page load
    setInterval(async () => {
      const s = await chrome.storage.local.get("myAgentId");
      if (s.myAgentId && s.myAgentId !== agentId) {
        agentId = s.myAgentId;
        if (currentStatus) chrome.runtime.sendMessage({ type:"STATUS_CHANGE", agentId, status: currentStatus });
      }
    }, 5000);
    const start = () => {
      scanForStatus();
      startObservers();

      // Scan on any click — status usually changes after a user interaction
      document.addEventListener("click",      () => { setTimeout(scanForStatus,300); setTimeout(scanForStatus,800); setTimeout(scanForStatus,2000); }, true);
      // Scan on keyboard input too — some status changes happen via keyboard
      document.addEventListener("keyup",      () => setTimeout(scanForStatus, 500), true);
      // Scan on focus change — agents switch status by clicking dropdowns/buttons
      document.addEventListener("focusin",    () => setTimeout(scanForStatus, 400), true);
      // Scan on mouseup — catches drag/select interactions
      document.addEventListener("mouseup",    () => setTimeout(scanForStatus, 300), true);

      // Frequent polling: every 2s instead of 5s for better real-time feel
      setInterval(scanForStatus, 2000);
      // Also push current status to popup every 5s even if unchanged
      // (keeps the popup in sync if it was opened mid-session)
      setInterval(() => {
        if (currentStatus) {
          chrome.runtime.sendMessage({ type:"STATUS_CHANGE", agentId, status: currentStatus });
        }
      }, 5000);
    };
    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", () => setTimeout(start, 2000)) : setTimeout(start, 2000);
  }

  chrome.runtime.onMessage.addListener((msg, _, respond) => {
    if (msg.type === "FORCE_SCAN") { scanForStatus(); respond({ status: currentStatus, agentId }); }
    if (msg.type === "GET_CURRENT_STATUS") respond({ status: currentStatus, agentId });
    if (msg.type === "UPDATE_AGENT_ID" && msg.agentId) {
      agentId = msg.agentId;
      chrome.storage.local.set({ myAgentId: msg.agentId });
      // Re-report current status under new agentId
      if (currentStatus) {
        chrome.runtime.sendMessage({ type:"STATUS_CHANGE", agentId, status: currentStatus });
      }
    }
  });

  init();
})();
