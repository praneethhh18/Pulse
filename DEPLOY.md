# 🚀 Pulse — Go-Live Guide

Everything is built to run **demo-mode now** and flip to **production** when you add
secrets. This is the exact checklist for taking Pulse live. Nothing here needs code
changes — only configuration.

---

## 0. The secrets you'll gather
| Secret | For | Where to get it |
|---|---|---|
| `MONGODB_URI` | Real database | MongoDB Atlas (free M0) |
| `GEMINI_API_KEY` | Real AI reasoning + OCR | https://aistudio.google.com/apikey |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail + Calendar auto-fetch | Google Cloud Console → OAuth client |
| `TOKEN_ENCRYPTION_KEY` | Encrypt OAuth tokens at rest | `openssl rand -base64 32` |
| `ALLOWED_ORIGINS` | CORS lockdown | your web/app domains |
| `FIREBASE_SERVICE_ACCOUNT` | Multi-user auth (API verifies tokens) | Firebase → Service accounts → private key (paste JSON) |
| `EXPO_PUBLIC_FIREBASE_*` | Multi-user auth (app sign-in) | Firebase → your Web app config (apiKey, authDomain, projectId, appId) |

---

## 1. MongoDB Atlas
1. Create a free **M0 cluster** at mongodb.com.
2. Add a database user + allow your IP (or `0.0.0.0/0` for Cloud Run).
3. Copy the **SRV connection string** → `MONGODB_URI`.
4. **Vector index** (for semantic search): Atlas → your cluster → *Atlas Search* →
   *Create Search Index* → **JSON editor** → on collection `documents`:
   ```json
   {
     "fields": [
       { "type": "vector", "path": "embedding", "numDimensions": 768, "similarity": "cosine" },
       { "type": "filter", "path": "userId" }
     ]
   }
   ```
   Name it **`vector_index`**. (Until it exists, search falls back to in-app cosine.)
5. Keep `SEED_DEMO_DATA=false` so no demo data lands in your real DB.

## 2. Gemini
- Get a key → set `GEMINI_API_KEY`. `/health` will then report `"ai":"gemini"`.
- This powers real email triage, the agent's answers, and **photo OCR**.

## 3. Google OAuth (Gmail + Calendar)
1. Google Cloud Console → **APIs & Services** → enable **Gmail API** and **Google Calendar API**.
2. **OAuth consent screen**: External, add your email as a **test user** (works
   immediately for your own account; public launch needs Google verification).
3. **Credentials → Create OAuth client → Web application**.
4. Add **Authorized redirect URI**: `https://YOUR_API_DOMAIN/gmail/callback`
   (after step 5 you'll know the domain). For local testing you can also add
   `http://localhost:4000/gmail/callback`.
5. Copy client id/secret → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and set
   `GOOGLE_OAUTH_REDIRECT` to the exact redirect URI.
6. Set `TOKEN_ENCRYPTION_KEY` (required — tokens are encrypted at rest).

## 4. Deploy the API (Cloud Run)
A `Dockerfile` is included. From `apps/api`:
```bash
gcloud run deploy pulse-api \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars "MONGODB_URI=...,GEMINI_API_KEY=...,GOOGLE_CLIENT_ID=...,GOOGLE_CLIENT_SECRET=...,GOOGLE_OAUTH_REDIRECT=https://YOUR_API_DOMAIN/gmail/callback,TOKEN_ENCRYPTION_KEY=...,ALLOWED_ORIGINS=https://YOUR_APP,SEED_DEMO_DATA=false"
```
- Cloud Run gives you `https://YOUR_API_DOMAIN` → put that in the OAuth redirect (step 3.4) and redeploy if needed.
- `/health` should show `"storage":"mongo","ai":"gemini"`.

> Secrets tip: prefer **Google Secret Manager** over `--set-env-vars` for real secrets.

## 5. Mobile app
1. Point the app at the deployed API — set `EXPO_PUBLIC_API_URL=https://YOUR_API_DOMAIN`
   (in `apps/mobile/.env` or the EAS build profile).
2. **EAS development/production build** (unlocks push + on-device permissions; Expo
   Go can't do those):
   ```bash
   cd apps/mobile
   npm i -g eas-cli && eas login
   eas build --profile development -p android   # or production
   ```
3. Install the build, open it, **Settings → Connect Gmail** → authorize once →
   Gmail **and** Calendar auto-sync; nudges fire from real data.

---

## What's production-ready vs. still to do
**Ready for live:** encrypted token storage, demo-data gating, multi-user inbox/
calendar monitors, security headers (helmet), CORS lockdown, rate limiting, clean
error handling, containerized deploy.

**Multi-user (Firebase Auth):** built and dormant. To turn on:
1. Firebase console → create project → add a **Web app** → copy config into
   `apps/mobile/.env` (`EXPO_PUBLIC_FIREBASE_*`); enable **Email/Password** sign-in.
2. Service accounts → generate a private key → paste the JSON (one line) into the
   API's `FIREBASE_SERVICE_ACCOUNT`.
3. Restart both. The app now shows a sign-in screen; the API requires a valid token
   and scopes all data per real user. Without this config, it stays single-user demo.

**Remaining production work (tracked in PROGRESS.md):**
- **Cloud file storage (GCS)** — move document image bytes out of the DB at scale.
- **Push notifications (FCM)** — needs the EAS build above.
