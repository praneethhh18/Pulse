# ✅ Pulse — Progress Tracker

Tick boxes as you go. `[x]` = done, `[ ]` = pending.
Three sections: **Built**, **To test on device**, **Next to build**.

> Tip: in VS Code, click inside a `- [ ]` and it becomes `- [x]` — or just type the `x`.

---

## 🟢 Phase 0 — Built & verified (this session)

### Backend (NestJS — `apps/api`)
- [x] Project scaffold, TypeScript, builds clean
- [x] Persistence layer with **MongoDB ↔ in-memory** fallback (demo mode)
- [x] All **10 collections** modeled
- [x] Seed data (documents, emails, calendar) — name is now generic ("Alex")
- [x] LLM service: **Gemini + deterministic mock** fallback
- [x] Embeddings (Gemini live / hashing mock)
- [x] **Document Vault** + semantic vector search — *verified*
- [x] **Email Guardian** (urgency + deadline + resurface) — *verified*
- [x] **Context Engine** nudges (flight/meeting, deadline, expiry) — *verified*
- [x] **Ask Pulse** agent (RAG over your life) — *verified*
- [x] Overview/dashboard endpoint
- [x] Boots, all routes mapped, endpoints tested live

### Mobile app (Expo React Native — `apps/mobile`)
- [x] Scaffold on **stable Expo SDK 55** (Expo Go compatible)
- [x] Premium design system / theme (lightened palette)
- [x] Bottom-tab navigation: Home · Vault · Guardian · Ask
- [x] Home dashboard (hero, stats, nudges, needs-you, coming-up)
- [x] Vault screen (semantic search + results)
- [x] Guardian screen (email triage + mark handled)
- [x] Ask screen (chat + suggestions)
- [x] NudgeCard with expandable "why Pulse flagged this"
- [x] LIVE/DEMO mode badge
- [x] API client + types
- [x] Typechecks clean + web bundle builds

### Docs
- [x] `IMPLEMENTATION_PLAN.md` (full multi-year, all 15 features)
- [x] `README.md` (run + go-live guide)
- [x] `PROGRESS.md` (this file)

---

## 🧪 To test on device (tick after you check each)

### Setup
- [ ] API runs: `cd apps/api && npm run start:prod` → http://localhost:4000/health OK
- [ ] App opens in browser: `cd apps/mobile && npm run web`
- [ ] App opens in **Expo Go**: `npm start` (or `npm run tunnel`)
- [ ] App reaches API from phone (set `EXPO_PUBLIC_API_URL` to PC LAN IP)

### Feature checks
- [ ] Home shows greeting + 3 stat tiles
- [ ] Nudges appear; the flight-vs-meeting "leave by 4:30" one shows
- [ ] Tap "Why did Pulse flag this?" → reason + sources expand
- [ ] Vault: search "health coverage" → Insurance Policy ranks #1
- [ ] Vault: search "where do I live" → Rental Agreement ranks #1
- [ ] Guardian: emails sorted by urgency; "resurfaced" tag on KYC mail
- [ ] Guardian: "Mark handled" works and updates
- [ ] Ask: "what's due this week?" returns a grounded answer
- [ ] Pull-to-refresh on Home works
- [ ] UI brightness/colors look good (adjust theme if not)

### Go-live checks (optional, when keys added)
- [ ] Add `MONGODB_URI` → `/health` shows `"storage":"mongo"`
- [ ] Create Atlas vector index `vector_index` (dim 768, cosine)
- [ ] Add `GEMINI_API_KEY` → `/health` shows `"ai":"gemini"`
- [ ] Semantic search + Ask quality improves with real models
- [ ] Add `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` → Settings shows Gmail "READY"
- [ ] Settings → Connect Gmail → authorize → real inbox auto-syncs into Guardian
- [ ] Same connection → real calendar events sync → scheduling nudges fire

---

## 🔲 Next to build (Phase 0 polish → Phase 1)

### Phase 0 polish
- [x] Document **upload** UI (text + **camera/gallery photo** with OCR-on-Gemini)
- [x] **Email ingest** UI (paste / sample → live triage)
- [x] **Settings** tab (connections + system status)
- [x] Add document **categories filter** in Vault (+ pull-to-refresh)
- [x] **Dismiss/acknowledge nudges** (swipe-away that sticks)
- [x] More nudge types (needs-action email, busy day)
- [x] **Branding** — app name "Pulse", dark theme, splash bg, bundle IDs, permissions
- [ ] Custom app icon artwork (currently default placeholder)
- [ ] Empty-state + error polish, loading skeletons
- [ ] Light theme option / theme toggle
- [ ] PDF upload (expo-document-picker)

### Phase 1 — Foundation (from the plan)
- [ ] Firebase Auth (real accounts, replace demo user)
- [x] **Gmail OAuth ingestion + auto-monitor** — BUILT; activates when Google creds added
- [x] **Google Calendar** integration + auto-monitor — BUILT; same Google connection
- [ ] Push notifications (FCM) for nudges
- [ ] Encryption + consent ledger + export/delete
- [ ] Offline sync (Realm / Atlas Device Sync)
- [ ] Move to an **EAS development build** (unlocks phone permissions) — `eas.json` ready; run `eas build --profile development -p android`

---

*Phases 2–5 (all remaining features + tiers) are detailed in `IMPLEMENTATION_PLAN.md`.*
