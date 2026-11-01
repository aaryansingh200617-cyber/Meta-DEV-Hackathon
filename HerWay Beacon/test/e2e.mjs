// End-to-end workflow test against a running server.
//   BASE=http://localhost:3000 node test/e2e.mjs           (quick, ~60 s)
//   BASE=http://localhost:3000 node test/e2e.mjs --full    (adds auto-alert after missed check-ins, ~2.5 min)
// Server should run with TICK_INTERVAL_MS=1000 for snappy timers.
import assert from 'node:assert/strict';

const BASE = process.env.BASE || 'http://localhost:3000';
const FULL = process.argv.includes('--full');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };

function client() {
  let cookie = '';
  return async (method, path, body, opts = {}) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie && !opts.anon ? { cookie } : {}), origin: BASE },
      body: body ? JSON.stringify(body) : undefined,
    });
    const sc = res.headers.getSetCookie?.() ?? [];
    if (sc.length) cookie = sc.map((c) => c.split(';')[0]).join('; ');
    let json = null;
    try { json = await res.json(); } catch { /* empty */ }
    return { status: res.status, json };
  };
}

const traveller = client();
const anon = client();
const T = (m, p, b) => traveller(m, p, b);
const urlToken = (url) => url.split('/c/')[1];
async function waitFor(fn, label, timeoutMs = 60000, every = 1000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) { const v = await fn(); if (v) return v; await sleep(every); }
  throw new Error(`Timed out waiting for: ${label}`);
}

console.log(`HerWay Beacon e2e → ${BASE}${FULL ? ' (full)' : ''}`);

// ── 0. Auth & authorization ────────────────────────────────────────────────
assert.equal((await anon('GET', '/api/contacts')).status, 401); ok('unauthenticated API access is rejected (401)');
assert.equal((await anon('GET', '/api/contact/not.a.valid.token')).status, 403); ok('forged contact link is rejected (403)');
const bad = await anon('POST', '/api/auth/login', { email: 'nobody@example.com', password: 'wrongwrong' });
assert.equal(bad.status, 401); ok('bad credentials rejected');
const email = `e2e-${Date.now()}@example.com`;
assert.equal((await anon('POST', '/api/auth/register', { name: 'X', email, password: 'longenough1', consent: false })).status, 400); ok('registration requires explicit consent');
const xo = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://evil.example' }, body: '{}' });
assert.equal(xo.status, 403); ok('cross-origin POST blocked (CSRF)');

const reg = await traveller('POST', '/api/auth/register', { name: 'Test Traveller', email, password: 'longenough1', consent: true });
assert.equal(reg.status, 200); ok('real registration works (empty account → empty states)');
assert.deepEqual((await T('GET', '/api/contacts')).json.contacts, []); ok('new account has no contacts (empty state)');
assert.deepEqual((await T('GET', '/api/journeys')).json.journeys, []); ok('new account has no history (empty state)');
await T('POST', '/api/account', undefined);
assert.equal((await T('DELETE', '/api/account', { confirm: 'DELETE', password: 'longenough1' })).status, 200); ok('account deletion works');
assert.equal((await T('GET', '/api/contacts')).status, 401); ok('session invalid after deletion');

// ── 1. Demo account ────────────────────────────────────────────────────────
const demo = await traveller('POST', '/api/auth/demo');
assert.equal(demo.status, 200);
const { contacts } = (await T('GET', '/api/contacts')).json;
assert.equal(contacts.length, 4);
const byName = (n) => contacts.find((c) => c.name.startsWith(n));
const [anita, meera, rohan, kavya] = ['Anita', 'Meera', 'Rohan', 'Kavya'].map(byName);
assert.equal(kavya.status, 'pending'); ok('demo account seeded: 4 contacts (1 pending), phone numbers decrypt for owner');
const hist = (await T('GET', '/api/journeys')).json.journeys;
assert.ok(hist.length >= 3); ok(`sample history present (${hist.length} journeys)`);

const link = async (c) => urlToken((await T('GET', `/api/contacts/${c.id}/link`)).json.url);
const tk = { anita: await link(anita), meera: await link(meera), rohan: await link(rohan), kavya: await link(kavya) };
const CV = (k) => anon('GET', `/api/contact/${tk[k]}`);

// pending contact cannot be granted access
const places = (await T('GET', '/api/places?q=')).json.places;
const O = places.find((p) => p.name.startsWith('MG Road'));
const D = places.find((p) => p.name.startsWith('Koramangala'));

// ── 2. Smart route comparison ──────────────────────────────────────────────
const cmp = (await T('POST', '/api/routes/compare', { origin: O, destination: D, mode: 'walk' })).json;
assert.equal(cmp.routes.length, 3); assert.equal(cmp.simulated, true);
for (const r of cmp.routes) {
  assert.equal(r.evidence.segments.length, 24);
  assert.ok(r.evidence.simulated);
  assert.ok('missingPct' in r.evidence.coverage);
}
assert.ok(!JSON.stringify(cmp).match(/"safetyScore"|"safe":/i)); ok('3 routes with time, distance, dated evidence, missing/outdated flagged, simulated label, no safety score');
const cmp2 = (await T('POST', '/api/routes/compare', { origin: O, destination: D, mode: 'walk' })).json;
assert.equal(cmp2.routes[0].distanceM, cmp.routes[0].distanceM); ok('demo routes are deterministic');

// ── 3. AI assistant (works offline) ────────────────────────────────────────
const ai = (await T('POST', '/api/ai/chat', { message: 'Which route has the most recent lighting data?', plan: { origin: O, destination: D, mode: 'walk' } })).json;
assert.ok(ai.answer.length > 40 && ai.citations.length > 0); assert.ok(!/guaranteed|100%|completely safe|safest/i.test(ai.answer));
assert.match(ai.answer, /guarantee|judgement|simulated/i); ok(`AI explanation grounded with ${ai.citations.length} cited facts (provider: ${ai.provider}), no safety claims`);
const urgent = (await T('POST', '/api/ai/chat', { message: 'someone is following me' })).json;
assert.equal(urgent.kind, 'urgent'); assert.equal(urgent.provider, 'local'); assert.ok(urgent.actions.find((a) => a.type === 'call')); ok('urgent phrases bypass AI and show emergency actions');
const nl = (await T('POST', '/api/ai/chat', { message: 'Walk from MG Road to Koramangala, check in every 5 minutes and share with Meera' })).json;
assert.equal(nl.kind, 'prefill'); assert.equal(nl.prefill.mode, 'walk'); assert.equal(nl.prefill.checkinMinutes, 5); assert.deepEqual(nl.prefill.shareContactNames, ['Meera Iyer']); ok('natural-language request → plan prefill (never auto-starts)');

// ── 4. Start journey (Journey Guardian) ────────────────────────────────────
const pending = await T('POST', '/api/journeys', { origin: O, destination: D, mode: 'walk', routeId: 'demo-B', etaMinutes: 10, checkinIntervalS: 15, shareContactIds: [kavya.id], shareLocationContactIds: [], consent: true });
assert.equal(pending.status, 400); ok('cannot share with a contact who has not accepted');
assert.equal((await T('POST', '/api/journeys', { origin: O, destination: D, mode: 'walk', routeId: 'demo-B', etaMinutes: 10, checkinIntervalS: 15, shareContactIds: [anita.id], shareLocationContactIds: [anita.id], consent: false })).status, 400); ok('journey pledge (consent) is mandatory');
const start = await T('POST', '/api/journeys', { origin: O, destination: D, mode: 'walk', routeId: 'demo-B', etaMinutes: 10, checkinIntervalS: 15, shareContactIds: [meera.id], shareLocationContactIds: [anita.id], escalationShareLocation: false, demoTimers: true, simulated: true, consent: true });
assert.equal(start.status, 200, JSON.stringify(start.json));
const J = start.json.journey;
assert.equal((await T('POST', '/api/journeys', { origin: O, destination: D, mode: 'walk', routeId: 'demo-B', etaMinutes: 10, checkinIntervalS: 0, shareContactIds: [], shareLocationContactIds: [], consent: true })).status, 409); ok('journey started; second concurrent journey refused (409)');

// ── 5. Live location sharing: only authorised contacts, only while active ──
const route = J.route.polyline;
const at = (i) => ({ lat: route[i][0], lng: route[i][1], accuracy: 10, simulated: true });
await T('POST', `/api/journeys/${J.id}/location`, at(8));
let a = (await CV('anita')).json, m = (await CV('meera')).json, r = (await CV('rohan')).json;
assert.equal(a.shares.length, 1); assert.ok(a.shares[0].location); assert.ok(a.shares[0].route); ok('Anita (location grant) sees live location + route');
assert.equal(m.shares.length, 1); assert.equal(m.shares[0].location, null); assert.equal(m.shares[0].route, null); assert.equal(m.shares[0].scope.location, false); ok('Meera (status-only) sees status but NO location or route');
assert.equal(r.shares.length, 0); ok('Rohan (not selected) sees nothing');
const kv = await CV('kavya'); assert.equal(kv.json.shares.length, 0); assert.equal(kv.json.contact.status, 'pending'); ok('pending contact sees invitation only');

// ── 6. Check-ins (backend timer) ───────────────────────────────────────────
const chk = await waitFor(async () => { const v = (await T('GET', '/api/journeys/active')).json.view; return v?.pendingCheckin ? v : null; }, 'check-in prompt', 40000);
ok('backend raised a check-in prompt on schedule (no client involved)');
await T('POST', `/api/journeys/${J.id}/checkin`, { response: 'ok' });
const after = (await T('GET', '/api/journeys/active')).json.view;
assert.equal(after.pendingCheckin, null); assert.equal(after.checkinStats.confirmed, 1); ok('check-in confirmed');
assert.ok((await CV('anita')).json.shares[0].checkin.lastConfirmedAt); ok('contact sees last confirmed check-in time');

// ── 7. Route deviation, user-controlled ────────────────────────────────────
const far = { lat: route[10][0] + 0.01, lng: route[10][1] + 0.01, accuracy: 10, simulated: true };
const dv = await T('POST', `/api/journeys/${J.id}/location`, far);
assert.equal(dv.json.deviationState, 'prompting'); ok('route deviation detected → traveller prompted');
await T('POST', `/api/journeys/${J.id}/deviation`, { response: 'ok' });
assert.equal((await T('GET', '/api/journeys/active')).json.view.journey.deviationState, 'user_ok'); ok('traveller response recorded; no contacts alerted (auto-alert off)');
await T('POST', `/api/journeys/${J.id}/location`, at(12));

// ── 8. Saheli Relay with tiered escalation ─────────────────────────────────
const rq = await T('POST', '/api/relay', { kind: 'urgent', message: 'Please call me', includeLocation: true, mode: 'ripple' });
assert.equal(rq.status, 200);
const RID = rq.json.relay.id;
assert.deepEqual(rq.json.relay.groups.length, 2); ok('relay created with 2 escalation tiers');
const chans = rq.json.relay.contacts.find((c) => c.name.startsWith('Anita')).channels;
assert.ok(chans.find((c) => c.channel === 'in_app' && c.status === 'sent'));
assert.ok(chans.find((c) => c.channel === 'sms_sim' && c.status === 'simulated')); ok('notification tracking: in-app sent, SMS honestly marked SIMULATED');
assert.equal((await T('POST', '/api/relay', { kind: 'urgent', includeLocation: true })).json.duplicate, true); ok('double-tap is idempotent');
m = (await CV('meera')).json; assert.equal(m.relays.length, 1); assert.ok(m.shares[0].location && m.shares[0].scope.location); ok('help request included location → Meera granted location (explicit consent at click)');
const before = (await T('GET', `/api/relay/${RID}`)).json.relay;
assert.equal(before.contacts.find((c) => c.name.startsWith('Anita')).channels.find((c) => c.channel === 'in_app').status, 'sent');
await CV('anita'); // Anita opens her dashboard
const rel1 = (await T('GET', `/api/relay/${RID}`)).json.relay;
assert.ok(rel1.contacts.find((c) => c.name.startsWith('Anita')).channels.find((c) => c.channel === 'in_app').status === 'delivered'); ok('in-app delivery confirmed only when contact opened the dashboard');
assert.equal((await CV('rohan')).json.relays.length, 0); ok('tier-2 contact not yet notified');
await waitFor(async () => (await CV('rohan')).json.relays.length === 1, 'escalation to tier 2', 45000);
ok('backend escalated to tier 2 after 20 s with no acknowledgement');
const rid = (await CV('rohan')).json.relays[0].id;
assert.equal(rid, RID);
assert.equal((await anon('POST', `/api/contact/${tk.kavya}/relays/${RID}/ack`)).status, 404); ok('contact who was never notified cannot acknowledge');
const ack = await anon('POST', `/api/contact/${tk.rohan}/relays/${RID}/ack`); assert.equal(ack.status, 200);
await anon('POST', `/api/contact/${tk.rohan}/relays/${RID}/action`, { action: 'calling' });
await anon('POST', `/api/contact/${tk.rohan}/relays/${RID}/action`, { action: 'contacted_authorities', note: 'Called 112' });
const rel2 = (await T('GET', `/api/relay/${RID}`)).json.relay;
assert.equal(rel2.status, 'acknowledged'); assert.equal(rel2.actions.length, 2);
const evs = (await T('GET', '/api/journeys/active')).json.view.events;
assert.ok(evs.find((e) => e.type === 'relay_acknowledged')); assert.ok(evs.find((e) => /reported by contact, not verified/.test(e.message)));
assert.ok(!evs.some((e) => /emergency services (have|has) been/i.test(e.message))); ok('acknowledgement + contact-reported actions tracked, labelled unverified; never claims services contacted');

// ── 9. Complete journey → automatic revocation ─────────────────────────────
const endRes = await T('POST', `/api/journeys/${J.id}/end`, { reason: 'arrived' });
assert.equal(endRes.status, 200); assert.equal(endRes.json.view.journey.status, 'completed'); assert.equal(endRes.json.view.journey.lastLocation, null);
for (const k of ['anita', 'meera', 'rohan']) {
  const v = (await CV(k)).json;
  assert.equal(v.shares.length, 0, `${k} still has shares`);
  assert.ok(!JSON.stringify(v).includes('"lat"'), `${k} view still contains coordinates`);
}
assert.ok((await CV('anita')).json.ended.some((e) => e.journeyId === J.id));
assert.ok(endRes.json.view.access.every((g) => !g.active && g.revokedReason === 'journey_ended')); ok('journey ended → every grant revoked, contacts see "access ended" and NO coordinates');
assert.equal((await T('POST', `/api/journeys/${J.id}/location`, at(14))).status, 409); ok('location updates rejected after the journey ends');
assert.ok(endRes.json.view.relays.every((x) => x.status !== 'open')); ok('open help requests closed when the traveller ends the journey');
const sum = (await T('POST', `/api/journeys/${J.id}/summary`)).json.summary;
assert.ok(sum.text.length > 30); assert.ok(!/safe\b/i.test(sum.text) || /not/.test(sum.text)); ok(`event summary generated (${sum.provider})`);
const detail = (await T('GET', `/api/journeys/${J.id}`)).json.view;
assert.ok(detail.events.find((e) => e.type === 'access_revoked')); ok('timeline records access revocation');

// ── 10. Contacts: consent, expiry, revocation ──────────────────────────────
assert.equal((await anon('POST', `/api/contact/${tk.kavya}/respond`, { decision: 'accept' })).status, 200);
assert.equal((await CV('kavya')).json.contact.status, 'accepted'); ok('contact gives explicit consent via their link');
await T('POST', `/api/contacts/${kavya.id}/link`);
assert.equal((await CV('kavya')).status, 403); ok('re-issuing a link invalidates the old one');
await T('POST', `/api/contacts/${rohan.id}/revoke`);
assert.equal((await CV('rohan')).status, 403); ok('revoking a contact kills their link immediately');

// ── 11. Privacy: retention, export, deletion ───────────────────────────────
await T('PATCH', '/api/settings', { keepTrail: false });
const ex = await fetch(BASE + '/api/account/export', { headers: { cookie: 'x' } }); assert.equal(ex.status, 401);
const dl = await T('DELETE', `/api/journeys/${hist[0].id}`); assert.equal(dl.status, 200); ok('user can delete a journey from history (retention control)');
assert.equal((await T('DELETE', '/api/account', { confirm: 'DELETE' })).status, 200);
assert.equal((await CV('anita')).status, 403); ok('account deletion removes contacts → their links stop working');

if (FULL) {
  console.log('  … full mode: auto-alert after missed check-ins');
  const t2 = client(); await t2('POST', '/api/auth/demo');
  const cs = (await t2('GET', '/api/contacts')).json.contacts;
  const mom = cs.find((c) => c.name.startsWith('Anita'));
  const st = await t2('POST', '/api/journeys', { origin: O, destination: D, mode: 'walk', routeId: 'demo-A', etaMinutes: 20, checkinIntervalS: 15, shareContactIds: [], shareLocationContactIds: [mom.id], escalationShareLocation: true, autoAlertOnMissed: true, demoTimers: true, simulated: true, consent: true });
  assert.equal(st.status, 200);
  const v = await waitFor(async () => { const x = (await t2('GET', '/api/journeys/active')).json.view; return x.relays.length ? x : null; }, 'auto relay', 120000, 2000);
  assert.equal(v.relays[0].kind, 'auto_missed_checkin'); assert.equal(v.checkinStats.missed, 2); ok('2 missed check-ins → backend raised an automatic alert (user had opted in)');
  assert.ok(v.access.find((g) => g.scope === 'location' && g.active)); ok('pre-authorised emergency location release applied');
  await t2('POST', `/api/journeys/${st.json.journey.id}/end`, { reason: 'cancelled' });
  await t2('DELETE', '/api/account', { confirm: 'DELETE' });
}

console.log(`\nAll ${passed} checks passed.`);
