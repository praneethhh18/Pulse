# ⚡ Pulse — The Life Agent

> *Never miss what matters.* A phone-first, proactive AI life agent that watches your
> documents, email and calendar, connects the dots a human would miss, and shows up
> with what you need **before you ask**.

This repo is the **Phase 0 MVP** from [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) —
built on the real, permanent stack (not a throwaway demo).

**It runs out of the box in DEMO MODE** (in-memory data + deterministic AI), and goes
fully live the moment you add a MongoDB Atlas URI and a Gemini API key. No code changes.

---

## What's built (Phase 0)

| Feature | What it does | Where |
|---|---|---|
| 🗂 **Document Vault + semantic search** | Find any document by *meaning* ("health coverage" → your insurance policy) via vector search | `apps/api/src/documents`, `apps/mobile/.../VaultScreen` |
| 🛡 **Email Guardian** | Reads mail, classifies urgency + deadlines, **resurfaces things you swiped away** | `apps/api/src/email`, `.../GuardianScreen` |
| ✨ **Context Engine** | Cross-references calendar + email + docs to fire **proactive, explainable nudges** ("6 AM flight after a 10 PM meeting — leave by 4:30") | `apps/api/src/context`, `.../components/NudgeCard` |
| 💬 **Ask Pulse** | Natural-language agent grounded in *your* life (RAG over your data) | `apps/api/src/agent`, `.../AskScreen` |

Every nudge stores **why it fired** and which records caused it — the trust/explainability
principle from the plan, built in from day one.

---

## Stack (the locked, permanent one)

- **Mobile (the product):** React Native + Expo + TypeScript + React Navigation
- **Backend:** NestJS (Node + TypeScript), modular per feature
- **Memory:** MongoDB Atlas (Vector Search) — with a transparent in-memory fallback for demo
- **Agent brain:** Google Gemini 2.5 Pro (behind an LLM-abstraction) — with a deterministic mock for demo
- **Web companion:** the same app runs in a browser via Expo web (read/preview surface)

```
Pulse/
├─ apps/
│  ├─ api/      NestJS backend (agent, documents, email, context, overview)
│  └─ mobile/   Expo React Native app (Home, Vault, Guardian, Ask)
├─ IMPLEMENTATION_PLAN.md   full multi-year plan (all 15 features)
└─ Pulse_Full_Vision.pdf    the product vision
```

---

## Run it

**Prerequisites:** Node 18+ (you have 24). Two terminals.

### 1. Backend
```bash
cd apps/api
npm install          # first time only
npm run build
npm run start:prod   # → http://localhost:4000  (DEMO MODE)
```
Check it: open http://localhost:4000/health → `{"status":"ok","storage":"memory","ai":"demo"}`

### 2. Mobile app  (Expo SDK 54 — matches the Play Store / App Store Expo Go)
```bash
cd apps/mobile
npm install          # first time only
npm run web          # preview in a browser  (easiest)
# or, on your phone with Expo Go:
npm start            # scan the QR (phone + PC on same Wi-Fi)
npm run tunnel       # use this if the QR won't connect (firewall / different network)
```
> **"Couldn't open in Expo Go"?** Almost always network/firewall — run `npm run tunnel`
> instead of `npm start`; it routes through a public URL and just works. (The first
> tunnel run may ask to install `@expo/ngrok` — say yes.)

> **On a physical phone?** Your phone can't see `localhost`. Set your computer's LAN IP:
> ```bash
> # in apps/mobile, create .env with:
> EXPO_PUBLIC_API_URL=http://YOUR_PC_IP:4000
> ```

---

## Go LIVE (real MongoDB + Gemini)

Edit `apps/api/.env`:
```env
MONGODB_URI=<your Atlas SRV string>     # free M0 cluster at mongodb.com
GEMINI_API_KEY=<your key>               # https://aistudio.google.com/apikey
```
Restart the API. `/health` will report `"storage":"mongo","ai":"gemini"`. The app is
identical — it just gets real vector search and real Gemini reasoning.

**For Atlas Vector Search**, create a vector index named `vector_index` on the
`documents` collection, field `embedding`, dimension **768** (Gemini `text-embedding-004`),
similarity `cosine`. Until then it falls back to in-app cosine automatically.

---

## Verified working

- ✅ API builds & boots; all routes mapped
- ✅ Semantic search returns the right doc for natural-language queries
- ✅ Context Engine fires the flight/meeting, deadline-resurface, and expiry nudges
- ✅ Agent answers grounded in seeded life data
- ✅ Mobile app typechecks and bundles (web export succeeds)
