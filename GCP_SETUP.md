# Pulse on Google Cloud — full setup

Everything Pulse needs, sourced from one GCP project so the $100 credit applies.
Each step ends with the exact env var(s) it produces. Backend vars go in
`apps/api/.env`; the `EXPO_PUBLIC_*` ones go in `apps/mobile/.env`.

Order matters: do 0 → 1 first (that alone makes the brain real). The rest are
optional upgrades you can add any time, then restart the API.

---

## 0. Project + billing (once)

1. Go to <https://console.cloud.google.com> → top bar → **Create project** → name it `pulse`.
2. Make sure it's **selected** in the top bar for every step below.
3. **Billing** → link your billing account (where the $100 credit lives).
   Most APIs below are free or pennies; billing just has to be attached.

---

## 1. Gemini — the AI brain  ⭐ (do this first)

Our backend talks to Gemini via the **Generative Language API** using a simple
API key (env: `GEMINI_API_KEY`).

1. **APIs & Services → Library** → search **"Generative Language API"** → **Enable**.
2. **APIs & Services → Credentials** → **Create credentials → API key**.
3. Copy the key. (Optional but recommended: **Edit API key → API restrictions →
   restrict to "Generative Language API"**.)

```
# apps/api/.env
GEMINI_API_KEY=AIza...your-key
# optional overrides (defaults are fine):
# GEMINI_MODEL=gemini-2.0-flash
# GEMINI_EMBED_MODEL=text-embedding-004
```

Restart the API → the Home badge flips from **Mock → Gemini**. Real reasoning,
real Hindi answers, real packing lists & flashcards.

> Prefer Vertex AI instead? It uses a service account, not an API key, and our
> code path is the API-key one — so stick with the key above. It bills to the
> same project, so the $100 still applies.

---

## 2. Gmail + Calendar — real inbox & events

1. **APIs & Services → Library** → enable **Gmail API** and **Google Calendar API**.
2. **APIs & Services → OAuth consent screen**:
   - User type **External** → fill app name "Pulse", your email as support/dev contact.
   - **Scopes** → Add: `.../auth/gmail.readonly` and `.../auth/calendar.readonly`.
   - **Test users** → add your own Google address (so you can log in while the
     app is unverified).
3. **Credentials → Create credentials → OAuth client ID** → **Web application**:
   - **Authorized redirect URI**: `http://localhost:4000/integrations/google/callback`
     (and later your Cloud Run URL + same path).
   - Create → copy **Client ID** and **Client secret**.

```
# apps/api/.env
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_OAUTH_REDIRECT=http://localhost:4000/integrations/google/callback
```

These OAuth tokens are stored encrypted — generate the key:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```
# apps/api/.env
TOKEN_ENCRYPTION_KEY=<the 64-char hex you just generated>
```

---

## 3. Cloud Storage — real document uploads

1. **Cloud Storage → Buckets → Create** → unique name e.g. `pulse-docs-<yourname>`,
   region near you, defaults are fine.
2. Auth: locally, create a service account so the API can read/write the bucket.
   - **IAM & Admin → Service Accounts → Create** → name `pulse-api`.
   - Grant role **Storage Object Admin** (scope to the bucket if you prefer).
   - **Keys → Add key → JSON** → download it to e.g. `apps/api/gcp-sa.json`
     (it's git-ignored; never commit it).

```
# apps/api/.env
GCS_BUCKET=pulse-docs-<yourname>
GOOGLE_APPLICATION_CREDENTIALS=./gcp-sa.json
```

On Cloud Run (step 5) you skip the JSON — the service runs *as* a service
account, so credentials are automatic.

---

## 4. Firebase Auth — phone-first login

Firebase sits on the same GCP project.

1. <https://console.firebase.google.com> → **Add project** → pick the **existing
   `pulse` GCP project**.
2. **Build → Authentication → Get started** → enable a sign-in method
   (Email/Password to start; Phone or Google later).
3. **Project settings → General → Your apps → Add app → Web** → copy the config.

```
# apps/mobile/.env
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=pulse-xxxx.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=pulse-xxxx
EXPO_PUBLIC_FIREBASE_APP_ID=1:....:web:....
```

Backend verifies the login token with a service account:

4. **Project settings → Service accounts → Generate new private key** → download JSON.
   Paste its contents as a single-line string (or a path) into:

```
# apps/api/.env
FIREBASE_SERVICE_ACCOUNT=<paste the JSON, single line>
```

When set, the app shows a sign-in screen instead of the auto demo-user.

---

## 5. Cloud Run — put the backend live (the best use of the $100)

So Pulse works without your laptop and judges can hit a public URL.

1. Install the gcloud CLI: <https://cloud.google.com/sdk/docs/install>, then:
   ```powershell
   gcloud auth login
   gcloud config set project pulse
   ```
2. Enable services:
   ```powershell
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
   ```
3. Deploy from the API folder (uses the included Dockerfile/buildpack):
   ```powershell
   cd apps/api
   gcloud run deploy pulse-api --source . --region asia-south1 --allow-unauthenticated `
     --service-account pulse-api@pulse.iam.gserviceaccount.com `
     --set-env-vars "GEMINI_API_KEY=...,MONGODB_URI=...,GCS_BUCKET=pulse-docs-<yourname>"
   ```
   (For secrets, prefer **Secret Manager** + `--set-secrets` over plain env vars.)
4. Copy the printed **service URL**, then point the app at it:
   ```
   # apps/mobile/.env
   EXPO_PUBLIC_API_URL=https://pulse-api-xxxx.a.run.app
   ```
5. Add that same URL + `/integrations/google/callback` to your OAuth redirect URIs (step 2).

---

## Not on GCP

- **MongoDB Atlas** is a separate provider. Use its **free M0** cluster, or your
  **MongoDB-track credits** — not the GCP $100. (You *can* buy Atlas via GCP
  Marketplace to apply the credit, but it's unnecessary for the demo.)
  ```
  # apps/api/.env
  MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority
  MONGODB_DB=pulse
  ```

---

## Spend strategy

- **Build/test on free tiers** — the Gemini key (step 1) is free-tier and is the
  single highest-impact secret. Atlas M0 is free.
- **Save the $100 for go-live**: Cloud Run hosting + Cloud Storage, and (if you
  want to show GCP-native AI) higher Gemini quota. That's where the credit earns
  its keep, not during development.
