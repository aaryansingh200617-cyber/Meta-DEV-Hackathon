// Shared domain types. Persisted rows are camelCase here; the Supabase driver maps
// top-level keys to snake_case columns (nested JSON stays as-is, stored in jsonb).

export type ISO = string;
export type LatLngTuple = [number, number];
export interface LatLng { lat: number; lng: number }
export interface Place extends LatLng { name: string; placeId?: string; source: 'google' | 'osrm' | 'demo' }

export type TravelMode = 'walk' | 'drive' | 'transit';

/* ───────────────────────────── Users & settings ───────────────────────────── */

export interface UserSettings {
  /** How long finished journeys (timeline, check-ins, help requests) are kept: days, or -1 = until I delete them. */
  retentionDays: number;
  /** Keep the precise GPS trail of finished journeys (within the retention period). Off = trail deleted when the journey ends. */
  keepTrail: boolean;
  emergencyNumber: string;
  defaultCheckinSeconds: number;
  checkinWindowSeconds: number;
  maxMissedCheckins: number;
  autoAlertOnMissed: boolean;
  autoAlertOnOverdue: boolean;
  graceMinutes: number;
  deviationThresholdM: number;
  deviationResponseSeconds: number;
  autoAlertOnDeviation: boolean;
  escalateAfterSeconds: number;
  aiEnabled: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  /** scrypt hash (file-store auth). Absent when Supabase Auth owns credentials. */
  passwordHash?: string;
  role: 'traveller';
  demo: boolean;
  createdAt: ISO;
  consentVersion: string;
  consentAt: ISO;
  settings: UserSettings;
  picture?: string;
  googleId?: string;
}

/* ───────────────────────────── Contacts ───────────────────────────── */

export type ContactStatus = 'pending' | 'accepted' | 'declined' | 'revoked';

export interface Contact {
  id: string;
  userId: string;
  name: string;
  relationship: string;
  /** AES-256-GCM encrypted at rest */
  phoneEnc: string | null;
  emailEnc: string | null;
  /** 1 = inner circle (first to be alerted), 2 = extended, 3 = backup */
  tier: 1 | 2 | 3;
  status: ContactStatus;
  /** Bumping this invalidates every previously issued link for this contact. */
  tokenVersion: number;
  tokenExpiresAt: ISO;
  consentedAt: ISO | null;
  seeded: boolean;
  createdAt: ISO;
}

export interface PushSubscriptionRow {
  id: string;
  contactId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: ISO;
}

/* ───────────────────────────── Routes & evidence ───────────────────────────── */

export type ObsKind = 'lighting' | 'visibility' | 'activity';
export type ObsValue = 'good' | 'moderate' | 'poor';
export type ObsSource = 'demo' | 'community';

export interface Observation {
  id: string;
  kind: ObsKind;
  value: ObsValue;
  lat: number;
  lng: number;
  observedAt: ISO;
  source: ObsSource;
  note?: string;
  /** Present only on stored (community) rows */
  userId?: string;
}

export interface AssistPoint {
  id: string;
  kind: 'police' | 'hospital' | 'pharmacy' | 'transit' | 'open_late';
  name: string;
  lat: number;
  lng: number;
  openNow: boolean | null;
  source: 'demo' | 'google' | 'osrm';
  /** Distance from the route (m) */
  offRouteM?: number;
}

export type SegmentStatus = 'fresh' | 'aging' | 'outdated' | 'missing';

export interface EvidenceSegment {
  index: number;
  status: SegmentStatus;
  ageDays: number | null;
  lighting: ObsValue | null;
  visibility: ObsValue | null;
  observationIds: string[];
  fromKm: number;
  toKm: number;
}

export interface RouteEvidence {
  segments: EvidenceSegment[];
  coverage: { freshPct: number; agingPct: number; outdatedPct: number; missingPct: number };
  lightingPoorSegments: number;
  lightingGoodSegments: number;
  assist: AssistPoint[];
  /** Longest stretch (km) with no assistance point within the search radius */
  longestAssistGapKm: number;
  newestObservationAt: ISO | null;
  observations: Observation[];
  sources: ('demo' | 'community' | 'google' | 'osrm')[];
  simulated: boolean;
  generatedAt: ISO;
}

export type SafetyTier = 'safest' | 'balanced' | 'direct';

export interface SafetySignalsSnapshot {
  litWaysNearby: number;
  primaryRoadPct: number;
  assistPointsCount: number;
  commercialDensity: number;
  longestDarkStretchM: number;
  dataAvailable: boolean;
}

export interface RouteOption {
  id: string;
  label: string;
  summary: string;
  distanceM: number;
  durationS: number;
  polyline: LatLngTuple[];
  source: 'google' | 'osrm' | 'demo';
  simulated: boolean;
  evidence: RouteEvidence;
  /** Women's safety ranking — present on live OSRM routes */
  safetyScore?: number;
  safetyTier?: SafetyTier;
  safetyLabel?: string;
  safetyReason?: string;
  safetySignals?: SafetySignalsSnapshot;
}

/* ───────────────────────────── Journeys ───────────────────────────── */

export type JourneyStatus = 'active' | 'completed' | 'cancelled' | 'expired';
export type DeviationState = 'on_route' | 'prompting' | 'user_ok' | 'alerted' | 'unanswered';

export interface JourneyLocation { lat: number; lng: number; accuracy: number | null; at: ISO; simulated: boolean }

export interface Journey {
  id: string;
  userId: string;
  status: JourneyStatus;
  mode: TravelMode;
  origin: Place;
  destination: Place;
  route: RouteOption;
  startedAt: ISO;
  expectedArrivalAt: ISO;
  graceMinutes: number;
  endedAt: ISO | null;
  endReason: 'arrived' | 'cancelled' | 'expired' | 'account_deleted' | null;
  overdueAt: ISO | null;
  checkinIntervalS: number; // 0 = off
  checkinWindowS: number;
  nextCheckinDueAt: ISO | null;
  missedStreak: number;
  maxMissed: number;
  autoAlertOnMissed: boolean;
  autoAlertOnOverdue: boolean;
  escalationShareLocation: boolean;
  deviationEnabled: boolean;
  deviationThresholdM: number;
  deviationResponseS: number;
  autoAlertOnDeviation: boolean;
  deviationState: DeviationState;
  deviationSince: ISO | null;
  deviationPromptExpiresAt: ISO | null;
  deviationSnoozeUntil: ISO | null;
  escalateAfterS: number;
  lastLocation: JourneyLocation | null;
  arrivalSuggested: boolean;
  simulated: boolean;
  /** Contacts who were told about the journey, with the scopes the traveller consented to */
  shared: { contactId: string; name: string; location: boolean }[];
  summary: { text: string; provider: string; at: ISO } | null;
  purgeAfter: ISO | null;
  trailPurgedAt: ISO | null;
}

export interface LocationPoint { id: string; journeyId: string; userId: string; lat: number; lng: number; accuracy: number | null; at: ISO; simulated: boolean }

export interface Checkin {
  id: string;
  journeyId: string;
  userId: string;
  dueAt: ISO;
  windowEndsAt: ISO;
  status: 'pending' | 'confirmed' | 'missed';
  respondedAt: ISO | null;
}

/** Location/status access granted to one contact for one journey. Expires and is revoked automatically. */
export interface Grant {
  id: string;
  journeyId: string;
  userId: string;
  contactId: string;
  scope: 'status' | 'location';
  createdAt: ISO;
  expiresAt: ISO;
  revokedAt: ISO | null;
  revokedReason: 'journey_ended' | 'expired' | 'user' | 'account_deleted' | null;
}

export type EventType =
  | 'journey_started' | 'access_granted' | 'checkin_prompted' | 'checkin_confirmed' | 'checkin_missed'
  | 'missed_threshold' | 'deviation_detected' | 'deviation_resolved' | 'deviation_response' | 'deviation_unanswered'
  | 'overdue' | 'eta_extended' | 'arrival_suggested' | 'relay_requested' | 'relay_sent' | 'relay_delivered'
  | 'relay_acknowledged' | 'relay_action' | 'relay_escalated' | 'relay_unanswered' | 'relay_resolved'
  | 'journey_ended' | 'access_revoked' | 'location_trail_deleted' | 'contact_viewed' | 'ai_summary';

export interface JourneyEvent {
  id: string;
  userId: string;
  journeyId: string | null;
  at: ISO;
  type: EventType;
  actor: 'traveller' | 'system' | 'contact';
  message: string;
  data?: Record<string, unknown>;
}

/* ───────────────────────────── HerWay Beacon Relay ───────────────────────────── */

export type RelayKind = 'call_me' | 'urgent' | 'auto_missed_checkin' | 'auto_overdue' | 'auto_deviation';
export type RelayStatus = 'open' | 'acknowledged' | 'resolved' | 'unanswered' | 'cancelled';
export type NotifChannel = 'in_app' | 'web_push' | 'sms_sim';
export type NotifStatus = 'queued' | 'sent' | 'delivered' | 'acknowledged' | 'failed' | 'simulated' | 'skipped';

export interface Relay {
  id: string;
  userId: string;
  journeyId: string | null;
  kind: RelayKind;
  message: string;
  status: RelayStatus;
  /** Escalation steps: each step is a group of contact ids that gets notified together. */
  groups: string[][];
  step: number;
  escalateAfterS: number;
  lastStepAt: ISO;
  createdAt: ISO;
  resolvedAt: ISO | null;
  includeLocation: boolean;
}

export interface RelayNotification {
  id: string;
  relayId: string;
  userId: string;
  contactId: string;
  step: number;
  channel: NotifChannel;
  status: NotifStatus;
  detail: string | null;
  sentAt: ISO | null;
  deliveredAt: ISO | null;
  acknowledgedAt: ISO | null;
}

export type RelayActionKind = 'calling' | 'on_my_way' | 'contacted_authorities' | 'cannot_reach' | 'note';

export interface RelayAction {
  id: string;
  relayId: string;
  userId: string;
  contactId: string;
  action: RelayActionKind;
  note: string | null;
  at: ISO;
}

/* ───────────────────────────── Store ───────────────────────────── */

export interface ConsentLog { id: string; userId: string; kind: string; detail: string; at: ISO }

export interface TableMap {
  users: User;
  contacts: Contact;
  push_subscriptions: PushSubscriptionRow;
  journeys: Journey;
  locations: LocationPoint;
  checkins: Checkin;
  grants: Grant;
  events: JourneyEvent;
  relays: Relay;
  relay_notifications: RelayNotification;
  relay_actions: RelayAction;
  observations: Observation & { userId: string };
  consent_log: ConsentLog;
}
export type TableName = keyof TableMap;
