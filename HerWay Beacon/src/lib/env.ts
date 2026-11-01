/** Central place that reads configuration and answers "which integrations are live?". */
export const env = {
  get appSecret() { return process.env.APP_SECRET || ''; },
  get supabaseUrl() { return process.env.NEXT_PUBLIC_SUPABASE_URL || ''; },
  get supabaseAnon() { return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''; },
  get supabaseService() { return process.env.SUPABASE_SERVICE_ROLE_KEY || ''; },
  get googleServerKey() { return (process.env.GOOGLE_MAPS_API_KEY || '').trim(); },
  get googleBrowserKey() { return (process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '').trim(); },
  get metaApiKey() { return (process.env.META_API_KEY || '').trim(); },
  get groqKey() { return (process.env.GROQ_API_KEY || process.env.MODEL_API_KEY || '').trim(); },
  get metaKey() { return (process.env.META_API_KEY || process.env.GROQ_API_KEY || process.env.MODEL_API_KEY || '').trim(); },
  get hasMetaKey() { return Boolean(process.env.META_API_KEY?.trim()); },
  get hasGroqKey() { return Boolean((process.env.GROQ_API_KEY || process.env.MODEL_API_KEY)?.trim()); },
  get metaBase() {
    if (process.env.META_API_KEY && process.env.META_API_BASE_URL) {
      return process.env.META_API_BASE_URL.trim().replace(/\/$/, '');
    }
    return (process.env.GROQ_API_BASE_URL || process.env.META_API_BASE_URL || 'https://api.groq.com/openai/v1').trim().replace(/\/$/, '');
  },
  get metaModel() {
    if (process.env.META_API_KEY && process.env.META_MODEL) {
      return process.env.META_MODEL.trim();
    }
    return (process.env.GROQ_MODEL || process.env.META_MODEL || 'openai/gpt-oss-120b').trim();
  },
  get vapidPublic() { return process.env.VAPID_PUBLIC_KEY || ''; },
  get vapidPrivate() { return process.env.VAPID_PRIVATE_KEY || ''; },
  get vapidSubject() { return process.env.VAPID_SUBJECT || 'mailto:admin@example.com'; },
  get cronSecret() { return process.env.CRON_SECRET || ''; },
  get tickMs() { return Number(process.env.TICK_INTERVAL_MS || 5000); },
  get dataDir() { return process.env.SJ_DATA_DIR || '.data'; },
  get mongoUri() { return process.env.MONGODB_URI || ''; },
  get mongoDb() { return process.env.MONGODB_DB || 'HerWayBeacon'; },
  get googleClientId() { return process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || ''; },
};

export const useSupabase = () => Boolean(env.supabaseUrl && env.supabaseService && env.supabaseAnon);
export const useMongo = () => Boolean(env.mongoUri && !useSupabase());
export const useGoogleAuth = () => Boolean(env.googleClientId);

export interface IntegrationStatus {
  database: { mode: 'supabase' | 'mongodb' | 'file'; live: boolean; label: string };
  auth: { mode: 'supabase' | 'mongodb' | 'local'; live: boolean; label: string; googleAuth: boolean };
  maps: { routes: 'google' | 'osrm' | 'demo'; tiles: 'google' | 'schematic'; label: string };
  ai: { provider: 'meta' | 'local'; model: string | null; label: string };
  push: { live: boolean; label: string };
  sms: { live: boolean; label: string };
  engine: { label: string };
}

export function integrationStatus(): IntegrationStatus {
  const sb = useSupabase();
  const mg = useMongo();
  const dbLabel = sb
    ? 'Supabase PostgreSQL'
    : mg
    ? 'MongoDB Atlas / Database'
    : 'Local file store (demo)';
  const dbMode = sb ? 'supabase' : mg ? 'mongodb' : 'file';
  const authLabel = sb
    ? 'Supabase Auth'
    : mg
    ? 'MongoDB Auth (scrypt + signed cookies)'
    : 'Local auth (scrypt + signed cookies)';
  return {
    database: { mode: dbMode, live: sb || mg, label: dbLabel },
    auth: { mode: sb ? 'supabase' : mg ? 'mongodb' : 'local', live: true, label: authLabel, googleAuth: useGoogleAuth() },
    maps: {
      routes: env.googleServerKey ? 'google' : 'osrm',
      tiles: env.googleBrowserKey ? 'google' : 'schematic',
      label: env.googleServerKey ? 'Google Routes + Places (Live)' : 'OpenStreetMap Live Worldwide Routing',
    },
    ai: env.metaKey
      ? {
          provider: 'meta',
          model: env.metaModel,
          label: env.hasMetaKey
            ? `Meta AI API · ${env.metaModel}`
            : `Groq AI · ${env.metaModel}`,
        }
      : { provider: 'local', model: null, label: 'Local rules engine (no API key)' },
    push: { live: Boolean(env.vapidPublic && env.vapidPrivate), label: env.vapidPublic && env.vapidPrivate ? 'Web Push (VAPID)' : 'Not configured — in-app only' },
    sms: { live: false, label: 'No SMS/voice provider — simulated only' },
    engine: { label: 'Server-side tick engine (deadline-driven, idempotent)' },
  };
}
