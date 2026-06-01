# Phone Awareness — build & enable guide

This is the capability that makes Pulse "the well-wisher who's with you": a native
Android service reads the notifications your phone receives (from any app) and
feeds them to the perception loop, which **learns about you** and **reminds you**
of what you'd forget. Nobody narrates their life — Pulse observes it.

## Why a dev build (not Expo Go)
Reading other apps' notifications needs a native `NotificationListenerService`.
Expo Go ships a fixed set of native modules and can't include custom ones, so the
capture module only runs in a **dev build** (an APK we compile). In Expo Go the
app still works — the Phone Awareness card just says "available in the full build".

The module is **ours** (`apps/mobile/modules/pulse-notifications`), built for the
current React 19 / RN 0.81 stack — no stale third-party dependency.

## One-time: build the APK with EAS (cloud — no Android Studio)

1. Make a free Expo account at <https://expo.dev/signup>.
2. From `apps/mobile`:
   ```powershell
   cd "c:\Users\Praneeth p\OneDrive\Desktop\Pulse\apps\mobile"
   npx eas-cli login          # sign in with the account above
   npx eas-cli build --profile development --platform android
   ```
   - First run asks to create the project / Android keystore → say **yes** to both.
   - It builds in the cloud (~10–20 min) and prints a **link + QR**.
3. On your phone, open the link → **download & install the APK** (allow "install
   from unknown sources" if prompted). This installs the real **Pulse** app.

## Every time you develop
1. Start the backend (with your live keys) as usual:
   ```powershell
   cd ..\api ; npm run start:prod
   ```
2. Start Metro in dev-client mode:
   ```powershell
   cd ..\mobile ; npx expo start --dev-client
   ```
3. Open the **installed Pulse app** (not Expo Go) → it connects to Metro and
   auto-detects your PC's API just like before.

## Turn it on (in the app)
1. **Settings → Phone awareness → Grant notification access.**
2. The system "Notification access" screen opens → toggle **Pulse** on → back.
3. The card flips to **"On — Pulse is watching over your phone."**
4. New notifications now stream to the backend automatically. Tap **"Catch up
   now"** (or just reopen the app) to have Pulse reason over them — new reminders
   appear on **Home**, new learnings under **Settings → what Pulse has learned**.

## How it works (data flow)
```
phone notification → PulseNotificationListenerService (native, runs even when app closed)
   → POST /me/signals?defer=1   (store only — cheap, no AI per notification)
app foreground / "Catch up now" → POST /me/signals/perceive
   → Gemini reasons over the batch → learns durable facts + writes reminders
   → reminders surface as Home nudges
```

## Privacy (by design)
- **Consent-gated** — nothing is read until you grant notification access; revoke
  anytime in system settings or by toggling Pulse off.
- **Filters noise** — OTPs, promotions and spam are ignored, never stored as reminders.
- **Minimization** — Pulse keeps compact, durable learnings (capped profile), not a
  copy of every message.
- **Yours** — export or delete everything from Settings at any time.

## Troubleshooting
- **"Pulse" doesn't appear in the Notification-access list** → rebuild after the
  manifest change; if it still doesn't show, set `android:exported="true"` on the
  service in `modules/pulse-notifications/android/src/main/AndroidManifest.xml`
  and rebuild.
- **Nothing arrives at the backend** → make sure the phone can reach your PC:
  open `http://<PC-IP>:4000/health` in the phone browser; check the Windows
  firewall rule for port 4000. The service uses the API URL captured the last
  time you opened the app, so reopen Pulse after your Wi-Fi/IP changes.
- **Build fails on EAS** → send me the EAS build log; native build issues are
  expected to need a round or two and the log names the exact fix.
