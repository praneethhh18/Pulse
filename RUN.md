# ▶️ Run Pulse end-to-end

Two parts run together: the **API** (backend brain) and the **app** (phone/browser).
Works fully in **demo mode** with no keys. Use two terminals.

> Prereqs: Node installed (you have v24), and **Expo Go** on your phone (Play/App Store).

---

## 1) Start the API — Terminal 1

```powershell
cd "c:\Users\Praneeth p\OneDrive\Desktop\Pulse\apps\api"
npm install        # first time only
npm run build
npm run start:prod
```

✅ You should see: `Pulse API listening on http://localhost:4000`
Check it: open <http://localhost:4000/health> → `{"status":"ok","storage":"memory","ai":"demo"}`

Leave this terminal running.

---

## 2) Start the app — Terminal 2

**Easiest (browser):**
```powershell
cd "c:\Users\Praneeth p\OneDrive\Desktop\Pulse\apps\mobile"
npm install        # first time only
npm run web
```

**On your phone (Expo Go):**
```powershell
npm start
```
Scan the QR with Expo Go. The app auto-detects your PC's IP for the API.

> **"Can't reach Pulse" on the phone?** Two one-time fixes (already done on this machine):
> 1. Set your PC IP in `apps/mobile/.env`: `EXPO_PUBLIC_API_URL=http://YOUR_PC_IP:4000` (find it with `ipconfig` → IPv4). Restart with `npx expo start -c`.
> 2. Allow port 4000 through Windows Firewall (admin PowerShell):
>    `New-NetFirewallRule -DisplayName "Pulse API 4000" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow`

---

## 3) What to try (the full demo, no keys needed)

- **Home** — see the proactive nudges (flight-vs-meeting "leave by", deadlines, expiries). Tap any event under *Coming up* → a prepared **briefing**.
- **Vault** — tap **+** → add a document (Camera/Gallery or text), set an expiry → it appears, becomes searchable, and may fire an expiry nudge. Search *"health coverage"* → finds your insurance by meaning. Filter by category.
- **Guardian** — tap **+** → pick a sample email → watch it get triaged (urgency + deadline). On an action email tap **Draft reply** → edit → **Copy**.
- **Ask** — type *"remember I'm vegetarian and my wife is Asha"*, then ask *"what do you know about me?"* → it recalls. Check **Settings → What Pulse has learned about you**, and notice nudges/greeting personalize.
- **Settings** — switch **Language → हिंदी**: the whole UI flips. Try **Export my data** / **Delete everything**. (Gmail/Calendar show OFF until you add Google keys.)

---

## 4) Go live (optional — real AI + data)

Demo mode uses mock AI + in-memory data. To make it real, fill in `apps/api/.env`
(blank = stays demo) and restart the API. Full steps + the Atlas vector index +
Google OAuth + Firebase are in **`DEPLOY.md`**. Quick wins:

- `GEMINI_API_KEY=...` → Ask, briefings, and reply drafts become genuinely smart **and answer in your chosen language**. `/health` shows `"ai":"gemini"`.
- `MONGODB_URI=...` → data persists across restarts. `/health` shows `"storage":"mongo"`.

---

## 5) Run the tests (optional)

```powershell
cd "c:\Users\Praneeth p\OneDrive\Desktop\Pulse\apps\api"
npm test
```
→ 32 tests, all green. (Also runs automatically on every GitHub push via CI.)

---

## Stop / restart
- Stop either terminal with **Ctrl + C**.
- After editing backend code: rebuild + restart Terminal 1 (`npm run build; npm run start:prod`).
- After editing app code: it hot-reloads; press **`r`** in Terminal 2 if needed.
