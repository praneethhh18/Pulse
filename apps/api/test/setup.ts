// Hermetic test environment (Hermes' conftest discipline): scrub any real
// credentials so tests are deterministic and never hit the network, and force
// demo mode (in-memory store + mock AI).
for (const key of Object.keys(process.env)) {
  if (/(_API_KEY|_TOKEN|_SECRET|PASSWORD|SERVICE_ACCOUNT)$/i.test(key)) {
    delete process.env[key];
  }
}
process.env.GEMINI_API_KEY = '';
process.env.MONGODB_URI = '';
process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
process.env.FIREBASE_SERVICE_ACCOUNT = '';
process.env.GCS_BUCKET = '';
process.env.DEFAULT_TIMEZONE = 'Asia/Kolkata';
process.env.TZ = 'UTC';
