# Deploying the Squad Dashboard to Vercel

This is Phase 1: backend + extension sync only. No login UI yet — anyone with the dashboard URL and a squad ID can view live status. Auth UI comes in Phase 2.

## What you're deploying

- **Next.js app** in `web/` — public read dashboard at `/dashboard?squad=<id>` plus two API routes:
  - `POST /api/status` — extension pushes one agent's status (requires `Authorization: Bearer <SQUAD_WRITE_TOKEN>`)
  - `GET /api/squad/[squadId]` — dashboard reads the full squad (currently unauthenticated)
- **Vercel KV** (Upstash Redis) — stores the squad object keyed by `squad:<id>`
- **Extension changes** in `8x8-clean/background.js` — every status change is mirrored to the backend in addition to local storage

## One-time setup

### 1. Push to GitHub

The Vercel dashboard flow expects a Git repo. From the project root:

```powershell
git init
git add .
git commit -m "Initial Squad Dashboard + extension sync"
```

Create an empty GitHub repo, then:

```powershell
git remote add origin https://github.com/<you>/<repo>.git
git branch -M main
git push -u origin main
```

### 2. Create the Vercel project

1. Go to https://vercel.com/new
2. Import the GitHub repo
3. **Root directory**: set to `web` (this is important — the Next.js app lives in a subfolder)
4. Framework preset: Next.js (auto-detected)
5. Click **Deploy**. The first build will pass; the API will return 500 until KV + env vars are configured (step 3–4).

### 3. Provision Vercel KV

1. In the Vercel project dashboard, open the **Storage** tab → **Create Database** → **KV**.
2. Name it (e.g. `squad-status`) → **Create**.
3. Vercel auto-injects `KV_REST_API_URL`, `KV_REST_API_TOKEN`, etc. into Preview + Production env. No manual env var copy needed.

### 4. Set the write token

1. **Settings** → **Environment Variables** → add:
   - Name: `SQUAD_WRITE_TOKEN`
   - Value: a long random string (e.g. `openssl rand -hex 32`)
   - Environments: Production, Preview, Development — all checked.
2. **Deployments** → top of the list → **⋯** → **Redeploy** (so the new env reaches the running app).

### 5. Wire the extension

Open `8x8-clean/background.js` and fill in the three constants at the top:

```js
const BACKEND_URL_DEFAULT = "https://your-app.vercel.app";
const SQUAD_ID_DEFAULT    = "trend-micro-bea";   // any string; teammates must all use the same
const WRITE_TOKEN_DEFAULT = "<paste the same SQUAD_WRITE_TOKEN value>";
```

Alternatively, leave the constants empty and run this once in the extension's service-worker DevTools console (chrome://extensions → "service worker" link under the extension):

```js
chrome.storage.local.set({
  backendUrl: "https://your-app.vercel.app",
  squadId:    "trend-micro-bea",
  writeToken: "<the SQUAD_WRITE_TOKEN value>",
});
```

The runtime values override the constants.

### 6. Reload the extension

`chrome://extensions` → toggle the extension off/on (or click the refresh icon). The manifest's `host_permissions` already covers `https://*.vercel.app/*`; if you use a custom domain, add it there and reload.

## Verify

1. Trigger a status change in 8x8 (or use the popup).
2. Service worker console should show no errors. Network tab → look for `POST /api/status` returning `200 {"ok":true,"lastUpdated":…}`.
3. Open `https://your-app.vercel.app/?` — enter your squad ID, click through to the dashboard. Your name should appear in the sidebar within ~3s.
4. Have a teammate set up the extension with the same `squadId` and `writeToken` — they'll appear in the same dashboard.

## Trade-offs (Phase 1)

- The dashboard is read-only **public**. Anyone who guesses your squad ID can view it. Pick an unguessable squad ID until Phase 2 adds login.
- `WRITE_TOKEN_DEFAULT` is shipped inside the extension. Anyone who unpacks the .crx can extract it and POST fake statuses. Acceptable for an internal squad tool; not acceptable if the extension ever ships to the Chrome Web Store. Phase 2 swaps this for per-user tokens minted after sign-in.
- KV entries TTL after 7 days of no writes — fine because the extension writes on every status change.

## Phase 2 (next)

- NextAuth (Google/Microsoft OAuth or magic-link email) gating the dashboard.
- Per-user API tokens issued from a `/settings` page; the extension fetches its token after the user signs in.
- Drop the shared `SQUAD_WRITE_TOKEN`.
