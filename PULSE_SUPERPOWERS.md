# ⚡ Pulse Superpowers — Ideas Distilled from the Hermes Agent

A prioritized menu of capabilities to implement, extracted from a deep source-level
study of the Nous Research **Hermes Agent**. Each item: **what**, **why it matters for a
proactive life-agent**, rough **effort**, and **how** in Pulse's stack (NestJS + TS +
MongoDB Atlas + Gemini + React Native). Tags: 🧠 intelligence · 🛡️ safety · ⚙️ reliability ·
🔌 capability · 📡 channels · 🌍 multimodal/India · 🧩 extensibility · 📈 data-flywheel.

> Source patterns verified in real Hermes code (file paths in `memory/hermes-agent-learnings.md`).

---

## 🏆 Top 10 (build these first, in roughly this order)

1. **🧠 Grow-with-you memory + background learning loop** — ✅ **BUILT**.
   After each Ask-Pulse turn an async, out-of-band pass extracts durable facts about the user
   (Gemini live, heuristic in demo) and edits a char-capped `user_profile` via add/replace/remove
   ops — **with Hermes' curated "don't-learn" prompt** so memory never self-poisons. Profile is
   injected into the agent so it personalises answers; shown in Settings → "What Pulse has learned
   about you". Files: `apps/api/src/memory/`. *(Next: latency-hiding recall + periodic curator.)*

2. **⚙️ Reliability/cost spine for unattended calls** — ✅ **BUILT** (error classifier · jittered
   backoff · model fallback chain · **cross-process rate-limit breaker in Mongo** `provider_state`).
   Every Gemini call (generate/ocr/embed) now retries transient errors, switches to a fallback model
   on rate-limit/overload, and trips a shared breaker so all workers back off. Files:
   `apps/api/src/llm/resilience.ts` + `llm.service.ts`. *(Next: per-job iteration+cost budget + output budgeting.)*

3. **🛡️ Tiered action-approval gate with a hardline floor** — classify every side-effecting
   action (send email, pay, delete, post) into `auto / confirm / hardline-blocked`. Hardline
   (money over X, account delete, mass-send) is **unconditional** — no automation mode bypasses it.
   *Effort: M.* NestJS guard + `approvals` collection; push-to-phone confirm; automation flag frozen at boot.

4. **🛡️ Consent contract: silence ≠ consent** — confirm prompts have a TTL; timeout = DENY; on
   deny, the model is told "do not retry, rephrase, or achieve the same outcome another way."
   Critical when running proactively with no human watching. *Effort: S.* TTL on confirm docs +
   a sweeper that auto-denies; inject the denial verbatim into the next turn.

5. **📡 Normalized channel adapter** — one `ChannelEvent` + `ChannelAdapter` (connect/send/sendMedia)
   so adding WhatsApp/SMS later = one adapter, agent core untouched. Highest-leverage for Pulse's
   multi-channel future. *Effort: M.* Make the current email path the first adapter; central base
   class handles media-download, length limits, a `platformHint` string.

6. **📡 Proactive cron + watcher engine with wake-gate + watermark dedup** — scheduled runs where a
   **cheap precheck** decides whether to wake the LLM (95% of ticks stay free), and watchers poll
   sources, store a watermark, and only act on *new* data (no spam). This is the literal engine of
   "proactive." *Effort: M.* `@nestjs/schedule` + Mongo `findOneAndUpdate` on `nextRunAt` as the
   at-most-once lock; per-watcher watermark doc.

7. **🔌 Capability registry with progressive disclosure + availability gating** — inject only a
   name+description **index** of features into the prompt; load full instructions on demand via a
   tool; hide capabilities the user can't use yet (e.g. Email Guardian before Gmail is linked).
   Lets Pulse ship 50 modules without bloating every Gemini call. *Effort: M.* `@Capability()`
   decorator + `DiscoveryService`; `list_capabilities` / `load_capability` function tools.

8. **🌍 Voice-note auto-transcription on ingest** — WhatsApp voice notes are the dominant input in
   India; transcribe on arrival (Gemini accepts audio directly — no Whisper infra) and prepend
   `[voice note]: "..."` so the rest of the loop stays text-only. *Effort: S.* Send the `.ogg` as
   `inlineData` to Gemini with "transcribe verbatim, keep language"; store transcript + language.

9. **🛡️ SSRF guard + prompt-injection fencing on all ingested content** — Pulse runs server-side and
   its main input (the inbox) is attacker-controllable. Block private/loopback/cloud-metadata IPs on
   any agent-driven fetch (fail closed); scan inbound email/web/calendar text for injection and fence
   tool/data results so the model can't confuse data for instructions. *Effort: S–M.* `isSafeUrl()`
   with `ipaddr.js` in an HTTP interceptor; a `threatPatterns` scan + `<external_data>` fences.

10. **🛡️ Transparent checkpoint / one-tap undo** — before the agent mutates user state (edits a
    draft, changes a calendar event), snapshot the prior state so the user can undo. Trust
    accelerator — people let an agent act freely when undo is guaranteed. *Effort: S.* `@Checkpoint()`
    interceptor writing `{entityId, before, turnId}`; "undo last action" in the app.

---

## Full menu by theme

### 🧠 Grow-with-you intelligence
- **Three memory tiers** kept separate: raw searchable log (Atlas vector) · tiny char-capped profile (always in prompt) · derived narrative user-model. Never conflate. *(M)*
- **Retain-filter before writes** — a cheap Gemini pass dedups/extracts salient facts before persisting, so memory stays high-signal. *(S)*
- **Periodic curator** — cron job ages memories/playbooks active→stale→archived (never hard-delete), consolidates overlaps, only touches agent-created data. *(M)*
- **Context Engine uses the profile** — ✅ **BUILT**. Learned facts now drive *proactive* nudges (e.g. health notes before a doctor visit) and personalise the home greeting, not just chat.
- **Latency-hiding recall** — run vector search/synthesis in the background after turn N, inject the cached result at turn N+1. *(S)*
- **Prompt-cache discipline** — stable system prefix; inject recalled memory into the *user turn* (fenced, scrubbed from output), never the system prompt. Cuts cost on every proactive call. *(S)*

### ⚙️ Reliability & cost (must-haves for unattended proactivity)
- Structured **error classifier** (rate-limit / billing / overloaded / timeout / context-overflow / safety-block / auth). *(S)*
- **Jittered exponential backoff** to decorrelate many workers retrying at once. *(S)*
- **Provider/model fallback chain** (flash → pro → secondary key) with eager switch on 429. *(S)*
- **Cross-process rate-limit breaker** in Mongo (`provider_state.resetAt`) — biggest cost win. *(S)*
- **Iteration + cost budget** per job, with sub-agent cost roll-up. *(S)*
- **3-layer tool/context output budgeting** — cap result, cap per-turn aggregate, persist overflow + inject a preview. *(S)*
- **Length-continuation + empty-response handling** for Gemini `MAX_TOKENS`/empty candidates. *(S)*
- **Streaming health watchdog** — kill a stalled stream so the retry loop reconnects. *(S)*

### 🛡️ Safety & trust (the agent acts on the user's behalf)
- Tiered approval gate + hardline floor *(M)* · consent contract *(S)* · proactive runs = locked-down trust context (no auto-approve when unattended) *(S)* · SSRF floor *(S)* · secret scrubbing + non-overridable deny-list *(S)* · injection scanning + result fencing *(S)* · checkpoint/undo *(S)* · **smart-approval triage** (cheap model approves trivial, escalates only genuine ambiguity — beats notification fatigue; never covers the hardline tier) *(S)*.

### 📋 Offline Life Briefing (core vision §3.3)
- **Pre-event briefings** — ✅ **BUILT**. Tap any upcoming event → Pulse assembles a prepared
  briefing from your documents + calendar + learned profile (Gemini live, structured template in
  demo): what it is, what to prepare, smart questions, relevant vault docs + remembered facts.
  Files: `apps/api/src/briefing/`. *(Next: pre-cache to device for true offline.)*

### ✉️ Email actions (core vision §3.2)
- **One-tap reply drafting** — ✅ **BUILT**. Guardian drafts a ready-to-send reply in your voice,
  personalised by the learned profile (Gemini live, templated in demo); edit + copy. Never sends.
  *(Next: send via Gmail API behind the approval gate.)*

### 🔌 Agent capability
- **Self-registering tool registry + `isAvailable()` gating** (only show Gemini tools that can run now); **behavioral guidance lives in the tool `description`**, not the system prompt (smaller, cacheable). *(M)*
- **Sub-agent delegation** — spawn focused children with isolated context + narrowed tools, run in parallel, parent sees only summaries; route cheap sub-tasks to Flash. Treat summaries as *unverified self-reports* — verify a returned handle before claiming success. *(M)*
- **Clarify primitive** — async-safe "should I book 3pm or 4pm?" that suspends the run, resumes on the user's reply, with a timeout + activity-touch so the watchdog doesn't kill a run waiting on a human. *(M)*

### 🧩 Extensibility & ecosystem
- **Pluggable provider backends** behind interfaces (PriceData, Memory, Notification, Payment) chosen by config — swap Yahoo→NSE/BSE, SMS→WhatsApp without touching modules. *(M)*
- **Lifecycle-hook bus** (`pre/post_tool_call`, `transform_result`, `on_session_end`) for cross-cutting PII redaction, spend-limit checks, audit logging. *(M)*
- **Integration catalog/hub** — manifest-driven opt-in integrations (banks, brokers, calendar) with declarative auth + a read-only default tool set; a "Connect" screen renders the prompts. *(M)*
- **Learned playbooks** — per-user routines the agent writes/patches from experience (mutable Mongo docs) vs immutable code modules. *(M)*
- **Skill bundles → "routines"** — a "morning briefing" = finance + calendar + price deltas + health reminder, one trigger. *(S)*

### 🌍 Multimodal & India edge
- **Native-vs-describe image routing** (pixels inline if model sees, else pre-describe). *(S)*
- **Indic-language i18n chrome** (Hindi/Tamil/Telugu/Bengali/Marathi/Kannada) — Hermes has **zero** Indic coverage; localize app chrome + let Gemini produce localized prose. Parity-tested. *(S)*
- **Multi-provider STT/TTS** with a free/offline fallback (cost + connectivity). *(M)*
- **Tiered OCR** — cheap text-layer extract first, escalate to Gemini vision only for scans/photos. *(M)*
- **Cached media store** with magic-byte validation + TTL cleanup. *(S)*

### 📈 Data flywheel (long-term moat)
- **Trajectory logging** in ShareGPT format (nearly free now, irreplaceable later). *(M)*
- **Trajectory/context compression** (protect head+tail, summarize middle) for long-lived sessions. *(M)*
- **Toolset distributions** for balanced eval/datagen. *(L)*
- **Self-improvement datagen → fine-tune a small model** for the common 80% (intent routing, bill parsing) while Gemini handles the hard 20% — India unit economics. *(L)*

---

---

## 🔬 Round-3 findings (production-ops & UX layers Hermes nails)

A third deep pass surfaced subsystems the first two missed. Highest-value first.

### Must-do once live (cost, trust, correctness)
- **🕐 Always-aware user-zone time** — ✅ **BUILT**. The phone sends its IANA timezone (`x-timezone`); every backend-formatted time (nudges, briefings) renders in the user's zone with a safe fallback (`DEFAULT_TIMEZONE`, invalid→UTC, never naive). Files: `apps/api/src/common/time.util.ts`. Verified: same flight reads 6:00 am in Kolkata, shifts correctly in New York.
- **💸 Prompt-caching discipline** — immutable cached system prefix, **date-only timestamp** (not minute — else cache busts every turn), volatility-ordered tiers (stable→context→volatile), per-turn dynamic steering appended *after* the cached block. Maps directly to Gemini `cachedContents`. Biggest per-call cost win when live. *(M)* `agent/system_prompt.py`, `prompt_caching.py`.
- **🔭 Hook-based, fail-open tracing** — trace each run as root→generation→tool spans; **deterministic trace id from `userId:runId`** so retries collapse; an observability outage never breaks the agent. Langfuse has a TS SDK. Essential for debugging unattended background calls. *(M)* `plugins/observability/langfuse`.
- **💰 Per-run cost accounting with confidence status** — `{input,output,cacheRead,cacheWrite}` token buckets + `CostResult{amountUsd, status: actual|estimated|included|unknown}`, persisted to a Mongo `runs` collection, `$group` dashboards. **Return `unknown` over a fabricated number.** Use `decimal.js`. *(M)* `agent/usage_pricing.py`.
- **🧾 Request-context logging + secret redaction** — bind `{userId,runId,feature}` to every log via `AsyncLocalStorage`/`nestjs-cls`; redact secret-shaped strings (API keys, JWTs, connection strings, phone numbers) from logs **and** any tool output entering a Gemini prompt. Pulse handles far more PII than a coding agent. *(M)* `hermes_logging.py`, `agent/redact.py`.

### Trust & UX
- **↩️ Transparent checkpoint / one-tap undo** — snapshot user state before any mutation; reversible undo; **"undo the undo"** (snapshot before restoring); **couple state-undo with conversational-context undo** so the agent doesn't "remember" doing something it reverted. The trust accelerator. *(M)* `tools/checkpoint_manager.py`.
- **💡 Contextual one-time onboarding hints** — no setup wizard; fire one just-in-time tip the first time a user hits each behavior (first nudge, first autonomous action, first quiet-hours mute), persisted per-user, never repeated, naming the exact control to change it. *(S, high ROI)* `agent/onboarding.py`.
- **⌨️ Single command registry** — one declarative `CommandDef[]` as source of truth; RN renders quick-action chips from the same list the backend dispatches. *(S–M)* `hermes_cli/commands.py`.

### Engineering foundation
- **🧪 Test foundation** — ✅ **BUILT**. Jest + ts-jest with a hermetic setup (scrubs credential env vars, forces demo mode, `TZ=UTC`); unit tests for the pure logic (time, resilience classifier, LLM heuristics), service tests (memory learning loop, context nudges + dismiss + tz), and a full-app `supertest` integration test. **32 tests green.** Files: `apps/api/test/`, `jest.config.js`. *(Next: add mobile RN tests + CI.)*
- **🔁 Background-job primitives** — atomic claim via Mongo `findOneAndUpdate({status:'ready'},…)`, heartbeat + claim-TTL reclaim of crashed jobs, consecutive-failure circuit breaker, separate `taskRuns` audit collection. Storage-agnostic; makes proactive work survivable. *(M)* `hermes_cli/kanban_db.py` (primitives only).
- **🛡️ Anti-hallucination ID validation** — when the agent claims it created/affected a record, verify the ID against the DB before accepting; on mismatch throw a *retryable* structured error that tells the model how to recover. *(S)* `tools/kanban_tools.py` `HallucinatedCardsError`.
- **📡 One typed streaming event contract** shared by web + mobile (`message.delta`/`tool.start`/`approval.request`…) when streaming is added. *(M)*
- **⚙️ Layered validated config** — defaults → per-user Mongo overrides → env, `zod` validation with actionable errors, cached on `updatedAt`. *(M)*
- **🏅 Retroactive achievements** (post-launch polish) — mine the activity log for tiered badges with secret/discovered states; **design the activity log now** so it's mine-able later. *(L)*

### Deferred-tool disclosure
- `tool_search`/`tool_describe`/`tool_call` bridges that hide tools from the model array until needed, gated above ~10% of context. *Only worth it past ~15 tools* — skip until then. *(M, later)*

### Honestly skip for Pulse (overkill / not applicable)
- **ACP editor adapter** (no editor client), **full kanban fleet** (worker subprocesses/profiles/swarm — take primitives only), **frontend plugin system with SRI** (single-product companion), **per-file test runner** (NestJS DI avoids the global-state problem), **pluggable compaction-strategy ABC** (one summarizer is enough now), **provider-quota polling** (use GCP budget alerts instead), **managed log-rotation handler** (log to stdout→aggregator).
- *Note:* Hermes' own `context_engine` plugin is a **history-compaction strategy**, NOT a cross-domain reasoner — orthogonal to Pulse's Context Engine; don't conflate them.

---

*This is a menu, not a commitment. Pulse already has: vector search, Gemini (LLM+vision OCR+embeddings),
Gmail/Calendar auto-fetch, encrypted tokens, multi-user auth, privacy controls, cloud storage, and the
security/deploy spine. The items above are what turn it from "very good" into a genuinely category-defining
proactive agent.*
