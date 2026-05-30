# Pulse — Definitive Build Plan

> **What this is:** the complete, decided implementation plan for the *entire* Pulse vision — all 15 feature modules, all 5 tiers, nothing skipped. Tech stack is locked (with rejected alternatives noted so decisions don't drift). Built phase-to-phase as one continuous flow, where each phase stands on the one before it.
>
> **Product shape:** phone-first agent (the product) + web companion (the memory window).
> **Money flow:** $100 builds Phase 0 → win → seed → each later phase is funded by the milestone before it.
> **Source of *what*:** `Pulse_Full_Vision.pdf`. This doc is the *how* and the *order*.
>
> **Companion docs:** `PROGRESS.md` (tickable status) · `PULSE_SUPERPOWERS.md` (the Hermes-derived capability menu) · `DEPLOY.md` (go-live secrets & steps).

---

## ✅ Build Status (living — updated as we ship)

**Phase 0 MVP: DONE and exceeded.** The real, permanent stack is live and runnable in demo mode, dormant-until-secrets for cloud. What's actually built so far:

- **Foundation:** NestJS API + Expo RN app; Mongo↔in-memory persistence (11+ collections); Gemini behind an LLM abstraction with a **resilience layer** (error classifier, jittered backoff, model fallback, cross-process rate breaker); demo-mode fallbacks everywhere.
- **Watch:** Document Vault (+ camera/OCR, vector search, category filter), Email Guardian (+ live triage, resurfacing), **Gmail + Google Calendar auto-fetch + monitors** (dormant until Google creds).
- **Learn (the superpower):** grow-with-you **memory + background learning loop** (Hermes' don't-learn discipline), char-capped profile injected into agent + nudges + greeting.
- **Connect:** Context Engine — cross-domain, explainable, dismissible nudges; **profile-aware** prep nudges; **relationship** nudges (birthdays/anniversaries + follow-ups).
- **Remember people:** **Relationship Memory** (§3.10) — people, notes, important dates, follow-ups; drives proactive birthday/follow-up nudges.
- **Track:** **Health Companion** (§3.6) — log vitals/medications/symptoms, latest readings + trends; feeds doctor briefings.
- **Money:** **Financial Pulse** (§3.7, demo) — spend by category over rolling 30-day windows, subscriptions, and a proactive "spent N% more on X" nudge (real bank sync via Plaid/Account-Aggregator is the live-only add-on).
- **Learn:** **Learning Companion** (§3.9) — goals + flashcards with **spaced repetition** (SM-2-lite), a quiz flow, and a "cards due for review" nudge; cards auto-generate with Gemini when live.
- **Travel:** **Travel Companion** (§3.8, demo) — trips with **AI packing lists**, a packing checklist, and a trip-countdown nudge (live flight-status APIs are the live-only add-on).
- **UX:** Home's secondary modules consolidated behind a single **"Spaces" launcher** (Money · People · Learn · Travel) — declutters the dashboard.
- **Prepare:** **Offline Life Briefing** (event + docs + profile → prepared brief).
- **Ask anything:** the agent answers across the user's *whole* life in one place — documents, mail, calendar, **health, money, people, learning** — grounded, personalised, in their language.
- **Act:** **one-tap AI reply drafting** (personalised, never sends).
- **Trust/ops:** Firebase Auth (multi-user, dormant), encrypted OAuth tokens, **export/delete-everything** privacy controls, GCS file storage (inline fallback), helmet/CORS/rate-limit/global-error-filter, **user-timezone-aware time** everywhere, Dockerfile + Cloud Run deploy guide.

**Two layers now run in parallel** (this is the reconciliation point — there are many features, tracked in two places):
1. **Vision phases (below)** — the long arc through all 15 modules + 5 tiers.
2. **Superpowers layer (`PULSE_SUPERPOWERS.md`)** — Hermes-derived capabilities (memory loop ✅, resilience ✅, context-uses-memory ✅, briefings ✅, reply drafts ✅, timezone ✅; next candidates: prompt-caching discipline, observability+cost, checkpoint/undo, onboarding hints, test foundation). These *harden and deepen* the vision modules rather than replacing them.

**Rule for adapting all these features without drift:** every new capability is still a *module on the platform* (Principle 1). Before building, check it's genuinely needed now (no speculative infra) and testable; mark it in `PROGRESS.md` + `PULSE_SUPERPOWERS.md` when shipped.

---

## Part I — Principles That Decide Everything

1. **Platform once, features forever.** Every feature is the same loop: `signal → understand (Gemini) → store with context (MongoDB) → connect (Context Engine) → act (nudge)`. Build that loop as a real platform first; then each feature is a *module* (a signal source + agent tools + a collection), never a rewrite.
2. **Phone-first, always-on.** The agent lives on the device. The web app only *reviews* what the agent did.
3. **Trust is the product.** Privacy, encryption, consent, and explainability are foundational (Phase 1), before any sensitive data flows. Get this wrong once and Pulse dies.
4. **Proactive, never just reactive.** If Pulse only answers when asked, it's just another chatbot and it loses. Every module must be able to *act unasked*.
5. **Offline by default.** Briefings, vault, and core reads work with no internet. Cloud is for heavy reasoning and sync.

---

## Part II — The Locked Tech Stack

Each row is a decision, not a suggestion. "Rejected" = what we deliberately did not choose and why.

### Clients

| Concern | **Decision** | Why | Rejected |
|---|---|---|---|
| Mobile (primary) | **React Native + Expo (TypeScript)** | One codebase iOS+Android; Expo speeds builds; ejectable for native modules (call/notification access) | Flutter (team is JS/TS; smaller hiring pool), native iOS+Android (2× cost) |
| Web companion | **React + Vite (TypeScript)** | Fast, shares TS types & logic with mobile | Next.js (don't need SSR for a read dashboard) |
| Mobile state | **Zustand + TanStack Query** | Simple store + cache/sync for server data | Redux Toolkit (heavier than needed) |
| Styling (mobile) | **NativeWind (Tailwind for RN)** | One styling mental model across web+mobile | styled-components (slower iteration) |
| Styling (web) | **Tailwind CSS** | Same as above | — |
| On-device DB | **Realm + Atlas Device Sync** | Native offline store that *syncs to Atlas for free* — directly powers offline briefings/vault | WatermelonDB/raw SQLite (would hand-build sync) |
| Local secure store | **expo-secure-store / Keychain / Keystore** | Hardware-backed key storage for on-device encryption keys | plain AsyncStorage (insecure) |

### Backend & Agent

| Concern | **Decision** | Why | Rejected |
|---|---|---|---|
| Language | **Node.js + TypeScript** | Same language end-to-end; huge ecosystem | Python (we'd split the stack; fine for ML jobs only) |
| Framework | **NestJS** | Modular by design — every Pulse feature is a Nest *module*; DI, guards, structure scales to dozens of features | Express/Fastify (less structure at this scale; Fastify kept for any perf-critical service) |
| Runtime host | **Google Cloud Run** | Serverless, autoscale to zero, cheap, container-based | GKE (ops overhead too early), App Engine (less flexible) |
| Agent brain | **Gemini 2.5 Pro via Vertex AI** + **Google Agent Builder** | Vision's choice; strong tool-calling + long context for the Context Engine | OpenAI/Anthropic direct (vendor lock vs Google credits; keep an LLM-abstraction layer so we *can* swap) |
| LLM abstraction | **Thin provider interface in-code** | Swap models per task/cost without rewrites (lesson borrowed from Hermes' LLM-agnostic design) | Hard-coding Gemini calls everywhere |
| Agent ↔ DB | **MongoDB MCP Server** + typed tool layer | Agent reads/writes Atlas via well-defined tools | Letting the model write raw queries (unsafe) |

### Data

| Concern | **Decision** | Why | Rejected |
|---|---|---|---|
| Primary DB | **MongoDB Atlas** | Flexible document model = can store "a whole life"; the partner track | Postgres (rigid schema fights an evolving life model) |
| Semantic search | **Atlas Vector Search** | Find docs/calls/notes by meaning | Pinecone/Weaviate (extra system; Atlas does it in-DB) |
| Keyword search | **Atlas Search (Lucene)** | Hybrid keyword + vector retrieval | Elasticsearch (another cluster to run) |
| Time-series | **Atlas time-series collections** | Native for vitals, prices, transactions, cash flow | Manual bucketing |
| Reactive triggers | **Atlas Change Streams + Pub/Sub** | "Salary arrived → recompute available money" reactions | Polling everything |
| Embeddings | **Vertex AI text-embedding models** | Same cloud, good quality | OpenAI embeddings (cross-vendor) |

### Integrations & Workers

| Concern | **Decision** | Why |
|---|---|---|
| Background jobs | **Cloud Scheduler → Cloud Run Jobs / Cloud Functions** | Price checks, email polling, briefing pre-gen, expiry & nudge sweeps |
| Queue / fan-out | **Cloud Pub/Sub + Cloud Tasks** | Decouple producers (change streams) from workers; retry/backoff |
| Notifications | **Firebase Cloud Messaging** (APNs/FCM under it) | Cross-device push |
| Email | **Gmail API + IMAP (node-imap)** | Multi-provider ingest |
| OCR | **Google Cloud Vision** (cloud) + **ML Kit** (on-device) | Cloud for depth, on-device for offline/privacy |
| Voice/calls | **Google Speech-to-Text + Gemini** | Transcription + entity extraction |
| Finance | **Plaid** (global) + **Account Aggregator** (Setu/Finvu, India UPI/bank) | Compliant bank access per region |
| Scraping | **Cloud Functions + Playwright** | Price engine; rate-limited; prefer official APIs first |
| Weather/news/flights | **OpenWeather/Tomorrow.io, a news API, AviationStack/flight API** | Pluggable data feeds |
| Smart home | **Matter + platform SDKs (Home/HomeKit)** | Standards-first device control |

### Security, Infra, Quality

| Concern | **Decision** | Why |
|---|---|---|
| Auth | **Firebase Auth (Google OAuth 2.0 first; Apple/email later)** | Frictionless, multi-provider, managed |
| Encryption | **Envelope encryption via Cloud KMS** + **client-side E2E for vault** | Server can't read the most sensitive data |
| Secrets | **Google Secret Manager** | No secrets in code |
| IaC | **Terraform** | Reproducible infra |
| CI/CD | **GitHub Actions** → Cloud Run; **EAS Build** for mobile | Automated build/test/deploy |
| Observability | **Cloud Logging/Monitoring + Sentry** | Errors, traces, cost alerts |
| Testing | **Vitest/Jest (unit), Supertest (API), Detox (mobile e2e), Playwright (web e2e)** | Quality gates per layer |
| Analytics (privacy-safe) | **Self-hosted PostHog or first-party events** | No third-party ad SDKs (vision: zero ads) |

---

## Part III — System Architecture

```
        ┌──────────────────────────┐      ┌──────────────────────────┐
        │  MOBILE (React Native)   │      │  WEB COMPANION (React)   │
        │  the agent — proactive,  │      │  read-mostly memory      │
        │  offline, on-device      │      │  window: review history  │
        │  Realm cache + KMS keys  │      │  TanStack Query reads    │
        └───────────┬──────────────┘      └────────────┬─────────────┘
                    │  HTTPS / WebSocket                │
        ┌───────────▼───────────────────────────────────▼───────────┐
        │  API GATEWAY  (NestJS on Cloud Run)                        │
        │  Firebase Auth · rate limit · consent guard · WS events    │
        └───────────┬───────────────────────────────────────────────┘
                    │
       ┌────────────┴─────────────┐         ┌───────────────────────┐
       │  AGENT ORCHESTRATOR       │  tools  │  CONTEXT ENGINE        │
       │  Gemini 2.5 Pro (Vertex)  │◄───────►│  cross-domain linker + │
       │  Agent Builder + tools    │  (MCP)  │  rules + learned model │
       └────────────┬─────────────┘         └───────────┬───────────┘
                    │                                    │
       ┌────────────▼────────────────────────────────────▼──────────┐
       │  MONGODB ATLAS (Life Memory)                                │
       │  Vector Search · Atlas Search · time-series · change streams │
       │  10 collections (Part V)                                     │
       └────────────┬────────────────────────────────────────────────┘
                    │ change streams → Pub/Sub
       ┌────────────▼────────────────────────────────────────────────┐
       │  WORKERS  (Cloud Scheduler · Cloud Run Jobs · Functions)     │
       │  price · email poll · briefing pre-gen · nudge sweep ·       │
       │  expiry · cash-flow · fraud · flight watch                   │
       └────────────┬────────────────────────────────────────────────┘
                    │
       ┌────────────▼────────────────────────────────────────────────┐
       │  INTEGRATIONS (added module by module)                       │
       │  Gmail/IMAP · Plaid/AA · Vision OCR · Speech-to-Text · FCM · │
       │  Playwright scrapers · weather/news/flight · Matter          │
       └─────────────────────────────────────────────────────────────┘
```

**Every feature plugs in the same way:** (1) a *signal source* (integration/worker), (2) *agent tools* registered with the orchestrator, (3) a *collection* in Atlas, (4) *Context Engine rules* that link it to the rest. That uniformity is what makes "all 15 features" tractable.

---

## Part IV — The Core Platform (built in Phase 1, reused by everything)

These are not features; they're the spine every feature depends on.

- **Agent tool framework** — a registry where a module declares tools (`searchDocuments`, `flagDeadline`, `getCashFlow`…) with typed schemas; the orchestrator exposes them to Gemini. Adding a feature = registering tools.
- **Context Engine service** — consumes change streams, maintains the cross-domain graph (links between events/people/money/health/calendar), runs **rules** + **learned patterns**, writes predictions & nudge candidates. Stores *why* each link/nudge exists (explainability).
- **Nudge/notification pipeline** — turns nudge candidates into well-timed FCM pushes, respecting learned per-user timing & channel preferences; logs delivery + outcome (feeds the learning loop).
- **Privacy & trust layer** — envelope encryption (KMS), client-side E2E for vault, a **consent ledger** (every enabled source, revocable), **export-everything** and **delete-everything**, and per-action explanations.
- **Offline sync layer** — Realm Device Sync; defines what's cached on device (vault, briefings, recent context) and conflict resolution.
- **Learning loop** — a formal `observe → update personal model → act better next time` cycle (the mechanism behind §4 of the vision), with outcome tracking on every action.

---

## Part V — Data Model (all 10 collections, defined in Phase 1)

Define the shape of the whole world early; the Context Engine is far easier when every collection exists, even if empty.

| Collection | Core fields | Special index |
|---|---|---|
| **users** | profile, preferences, learned patterns, personalisation weights, consent ledger, notification timing model | — |
| **documents** | file ref, OCR text, **embedding**, category, expiry date, version history, share tokens | vector + Atlas Search + TTL on shares |
| **price_watches** | target, platform, price history[], prediction, restock flag, source URL | time-series on history |
| **email_intelligence** | provider, message ref, summary, deadline, urgency score, action status, reply state | date + urgency |
| **health_records** | type (symptom/med/vital/report), value, timestamp, member id, trend links | time-series |
| **financial_transactions** | amount, category, account, recurring flag, fraud score, projection links | time-series |
| **event_briefings** | event type, generated content, cache state, valid-until | TTL / valid-until |
| **call_intelligence** | transcript, extracted entities[], **embedding**, timestamp | vector + Atlas Search |
| **relationship_memory** | person, details[], interaction history, follow-ups, important dates | date on dates/follow-ups |
| **context_engine** | cross-domain links, predictions, active nudge rules, *why-fired* audit | — |

**Day-1 indexes:** vector on `documents`/`call_intelligence`; time-series on health/finance/prices; TTL/valid-until on briefings & shares; per-user partition key on every collection.

---

## Part VI — Phase-by-Phase Build (the flow, every feature included)

Each feature block: **what it does · build · stack/APIs · data · depends on · done when.**

### PHASE 0 — Hackathon MVP  *( $100, weeks )*  → win, unlock budget
Prove the core loop end-to-end with the 3 features that best show *agentic + MongoDB + proactive*.

- **Platform skeleton:** NestJS on Cloud Run, Atlas M0, Gemini via Vertex, mini tool framework, Firebase Auth (single user), React web dashboard.
- **F: Document Vault (slice)** — upload/paste → OCR/text → embed → store → semantic search. *Stack:* Vision/ML Kit, Vertex embeddings, Atlas Vector Search. *Done when:* search by meaning returns the right doc.
- **F: Email Guardian (slice)** — one test Gmail → pull recent → Gemini deadline/urgency classify → store. *Done when:* a real deadline is detected & surfaced.
- **F: Context Engine (one wow)** — one real cross-domain rule producing a proactive nudge (e.g. flight vs late meeting → "leave by 4:30am"). *Done when:* Pulse says something unasked, correctly.
- **Demo:** 3-minute script, each beat mapped to a judging criterion, ending on the unasked catch.

### PHASE 1 — Foundation Platform  *( ~months 1–3 )*
No flashy features — build the spine from Part IV so everything later is a module.
- Multi-user auth, accounts, sessions, roles (sets up Family/Teams later).
- **Context Engine service** + change-stream → Pub/Sub → workers.
- All **10 collections** + indexes (Part V).
- **Privacy/trust layer**: KMS envelope encryption, client-side vault E2E, consent ledger, export/delete, explainability.
- **Offline sync** (Realm Device Sync) groundwork.
- **Nudge/notification pipeline** (FCM) + timing-preference model.
- **Agent tool framework** (production version) + **LLM abstraction**.
- **Learning loop** primitives + outcome tracking.
- CI/CD, IaC (Terraform), observability, cost alerts.
- *Done when:* a new feature can ship by registering tools + a collection + rules, with zero core rewrites.

### PHASE 2 — Core Life Features  *( ~months 3–9 )*  · React Native app ships
The daily-use features. Mobile becomes the primary surface here.

- **3.4 Document Vault & Intelligence (full)** — store all ID/medical/financial/legal/educational/vehicle docs; OCR + content search; **expiry intelligence** (6/3/1-month reminders for passport, licence, insurance, PUC); **contract analysis** (Gemini flags unusual clauses); auto-categorisation; **time-limited secure share links**; version history. *Stack:* Vision OCR, vector+Atlas Search, KMS/E2E, Cloud Scheduler (expiry sweep). *Depends:* privacy + search + offline. *Done when:* user finds any doc by description and gets a renewal reminder offline.

- **3.2 Email & Message Guardian (full)** — Gmail/Outlook/Yahoo/IMAP; detect deadlines/actions/financial/legal/govt; **resurface dismissed-but-important** before deadline; 2-line plain summaries; **one-tap reply drafting**; **scam/phishing detection**; **auto-extract meeting invites → calendar**; reply-tracking nudges (3-day); urgency auto-organisation. *Stack:* Gmail API + IMAP, Gemini classify/draft, FCM, calendar API. *Depends:* nudge pipeline. *Done when:* a buried deadline is caught and resurfaced with a draft reply.

- **3.3 Offline Life Briefing (full)** — auto-generated briefings per event type (interview, doctor, client meeting, exam, court, property), built from everything saved, **pre-cached to device**, delivered ~1 hr before. *Stack:* Gemini generation worker, Realm cache, calendar triggers. *Depends:* vault + health + relationship data, offline sync. *Done when:* a complete briefing opens with no internet, 1 hr before the event.

- **3.6 Health Companion (full)** — log symptoms/meds/vitals (BP, sugar, weight, sleep, steps, water); **trend analysis** over years; **medication reminders + streaks**; **menstrual cycle prediction** (fertile window, PMS forecast); **pre-appointment one-page summary**; prescription storage + **refill reminders (5-day)**; lab reports/images with cross-visit trends; **family health vault**; symptom-context checker (not diagnosis); **vaccination tracking + due reminders**. *Stack:* time-series collections, Gemini summaries, Cloud Scheduler, strong encryption. *Depends:* privacy layer. *Done when:* doctor-visit summary shows what changed since last visit.

- **3.1 Price Intelligence Engine (full)** — watch any product/ticket; **monitor across platforms 24/7**; **target-hit alert with buy link**; **price-history graph** (real drop vs fake sale); **drop prediction**; best-time-to-buy by category; learns buying patterns → proactive deals; tracks flash/festival/clearance sales; **back-in-stock alerts**. *Stack:* Playwright scrapers + official APIs, Cloud Scheduler (30-min), time-series history, Vertex AI prediction (heuristics first). *Depends:* nudge pipeline. *Done when:* a target-price drop pushes an alert with a working link.

### PHASE 3 — Intelligence, Money & Motion  *( ~months 9–18 )*  · compliance-heavy
Higher-trust modules; legal/compliance work is budgeted here.

- **3.7 Financial Pulse (full)** — connect bank/UPI; **auto-categorise spend**; **real-time fraud detection** (2am anomaly → wake user); track EMIs/subscriptions/recurring (this month/week/today); **net-worth dashboard**; **cash-flow prediction** (run out before salary? 2-week warning); **subscription audit** (forgotten charges); savings goals auto-tracked; bill reminders + one-tap pay; **tax assistant** (year-round deductible tagging); **split-expense tracking**. *Stack:* Plaid + Account Aggregator (Setu/Finvu), change streams (salary→recompute), time-series, fraud rules + Vertex AI. *Depends:* compliance/legal, banking partner approval. *Done when:* an anomalous transaction triggers an immediate alert and cash-flow warns 2 weeks early.

- **3.5 Call & Conversation Intelligence (full)** — **auto-capture numbers/addresses/account/reference codes** from calls; show extracted info at call end; optional full transcription; **meeting recording → summary + action items**; voice notes → searchable text; **search any word across all conversations**; mid-call keyword flag/timestamp; caller ID enhancement. *Stack:* Speech-to-Text, Gemini extraction, vector+Atlas Search, native call/audio modules (RN eject). *Depends:* **per-region call-recording consent law** (legal gate). *Done when:* a number shared on a call appears, captured, at call end.

- **3.8 Travel Companion (full)** — **flight monitoring** (delays/gate/cancel before the airline emails); **auto check-in 24h prior**; luggage tracking on connections; **all travel docs offline**; real-time currency; **auto timezone adjustment** of reminders; travel advisories; **packing-list generator** (weather + duration + your history); **itinerary build from confirmation emails**; local emergency/embassy/hospital info. *Stack:* flight API, currency API, advisory feed, email parser, Realm offline. *Depends:* email guardian, document vault. *Done when:* a gate change pushes before the airline, and an itinerary auto-builds from inbox.

- **3.11 News & World Intelligence (full)** — monitor news on your **investments/companies/industries**; deliver relevant news **before** meetings/interviews; **weather intelligence** ("umbrella — rain on your route at 3pm"); local events/traffic/strikes; regulatory changes for your profession; portfolio-relevant market moves in plain language. *Stack:* news API, weather API, Gemini summarisation, Context Engine targeting. *Depends:* relationship/calendar/finance context. *Done when:* a pre-meeting briefing includes timely, relevant news.

### PHASE 4 — Deepening & Full Context  *( ~months 18–30 )*
The "reads your mind" maturity, plus the remaining modules.

- **3.9 Smart Learning Companion (full)** — learning goals (skill/subject/language/cert) → **personalised daily plan**; **5-min micro-lessons**; **spaced-repetition** at the optimal forgetting moment; streaks + adaptive difficulty; **connects concepts to your real data** (finance lessons use your transactions); **exam countdown** with adaptive intensity. *Stack:* Gemini content/quiz gen, spaced-repetition scheduler, time-series progress. *Depends:* Context Engine (ties to personal data). *Done when:* a quiz resurfaces an at-risk item at the right time.

- **3.10 Relationship Memory (full)** — remember details about people (mentions, struggles, wins); **contextual birthday/anniversary** reminders ("last year you gave them a book they loved"); **follow-up reminders** ("you said you'd send Haresh the doc"); **pre-conversation briefings** (what you discussed last time); **gift suggestions**; life-event tracker (job/baby/health). *Stack:* people graph in `relationship_memory`, Gemini, nudge pipeline, message/call ingestion. *Depends:* email/call/message data. *Done when:* before a call, Pulse briefs you on the last conversation + open follow-ups.

- **3.12 Smart Home & Device Integration (full)** — connect AC/lights/camera/locks via **Matter**; learn patterns → auto-routines (no programming); **electricity monitoring** (costliest devices, when to run); **camera anomaly alerts**; **vehicle integration** (fuel, service due, insurance/PUC expiry). *Stack:* Matter SDK, platform integrations, anomaly detection, Cloud Scheduler. *Depends:* Context Engine, device ecosystem work. *Done when:* an unusual camera event pushes instantly and a routine fires unprompted.

- **3.13 Context Engine — full depth** — mature the cross-domain reasoning to the vision's flagship behaviours (flight-vs-meeting alarm+cab, salary-vs-rent-vs-EMI available money, LinkedIn skills-gap, "you mentioned Goa → flights dropped 40%", vaccination-vs-travel conflict, sleep/exercise pattern, investment-news flag). Continuously improves via the learning loop.

- **3.14 Proactive Nudges — full depth** — all nudge classes from the vision live and tuned by learned timing/preference. (Matures across every phase; reaches full depth here.)

### PHASE 5 — Tiers & Go-to-Market  *( ~months 24+, overlaps Phase 4 )*
- **Pulse Free** — price watch, email guardian, document vault, offline briefing, basic call intelligence. (Genuinely useful, not a crippled demo.)
- **Pulse Personal** — everything unlimited; full health/finance/travel/learning/relationship; **proactive nudges at full depth**; Context Engine at max.
- **Pulse Family** — up to 5 members, each with full Personal; **shared vault**; **family health** (kids' vaccines, elders' meds); shared financial overview; family calendar; **child safety** (location/safe-route).
- **Pulse for Teams** — shared meeting intelligence; team deadline tracking; **client relationship memory**; shared team vault; **project context engine**.
- **Pulse Enterprise** — custom internal-system integration; full API; dedicated support; org-specific security/compliance.

---

## Part VII — Cross-Cutting Workstreams (run in every phase)

- **Security & privacy** — pen-tests before each sensitive module; encryption review; consent UX; independent audit before Finance/Health scale.
- **Design system** — one component library shared across mobile/web; "one clean dashboard, zero learning curve" (vision 9/10 design bar).
- **Observability & cost** — dashboards + budget alerts from Phase 1; on-device processing to cut cloud spend.
- **Quality gates** — unit/integration/e2e per layer; no module ships half-built (each has explicit "done when").
- **Compliance** — banking (Phase 3), health data (Phase 2+), call recording (Phase 3), per-region.

---

## Part VIII — Team, Time & Cost

| Phase | Team | Calendar | Cloud spend |
|---|---|---|---|
| 0 Hackathon | 1–2 builders | weeks | **<$20 of $100** |
| 1 Foundation | 2–3 eng | ~3 mo | low (free tiers) |
| 2 Core | 3–5 eng + 1 design | ~6 mo | moderate (Atlas paid, Gemini scales w/ users) |
| 3 Money/Calls/Travel | 5–8 eng + compliance/legal | ~9 mo | higher (Plaid, transcription, data APIs) |
| 4 Depth | 8+ eng | ~12 mo | scales with users |
| 5 Tiers/GTM | + product, support, sales | ongoing | scales with revenue |

This is openly a **multi-year, funded-company** effort — which is the stated intent. Each phase reaches a real milestone so the next is fundable: **win → seed → traction → raise → scale.**

---

## Part IX — Risk Register

| Risk | Mitigation |
|---|---|
| Scope kills momentum | Phase 0 ships a winning slice fast; rest is sequenced, never simultaneous |
| Features before engine | Phase 1 forces platform-first; features are modules |
| Privacy/trust failure (fatal) | Trust layer is foundational (Phase 1) before sensitive data |
| Compliance walls (banking, call recording) | Quarantined to Phase 3 with budgeted legal work |
| Scraping fragility / ToS | Official APIs first; rate-limit; scraping is best-effort, not core |
| Vendor lock (Gemini) | LLM abstraction layer; swappable per task |
| Cost runaway at scale | Cost alerts from Phase 1; on-device processing; autoscale-to-zero |
| "All features, none deep" | Per-feature "done when"; no half-built ships |

---

## Part X — Definition of Done per Phase
- **0:** live demo catches something unasked; MongoDB + agent loop visible → **win.**
- **1:** new feature ships via tools + collection + rules, zero core rewrites; privacy/offline/nudges generic.
- **2:** a real user runs daily life on Pulse (docs, email, health, briefings, prices) on mobile.
- **3:** money + calls + travel + news live, compliant, trusted.
- **4:** Context Engine demonstrably anticipates needs; all 15 modules shipped.
- **5:** all five tiers live and monetising.

---

## Appendix — Prior Art to Borrow (not copy)
- **Nous Research Hermes Agent** — its explicit *learning loop* and *LLM-agnostic* design validate two of our choices (formal learning loop in Part IV; LLM abstraction in Part II). Its multi-channel chat gateway is a useful reference for message ingestion (3.2). Key difference: Hermes is *reactive/conversational*; Pulse must be *proactive/on-device*. We borrow the mechanism, not the form. (Deep-dive deferred per owner.)

---

*Nothing in the vision is skipped. The sequencing is what makes "build everything" real — we skip nothing, we just refuse to build it all at once.*
