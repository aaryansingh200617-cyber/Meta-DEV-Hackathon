import type { UserSettings } from './types';

export const CONSENT_VERSION = '2026-10-v1';

export const DEFAULT_SETTINGS: UserSettings = {
  retentionDays: 30,
  keepTrail: true,
  emergencyNumber: '112',
  defaultCheckinSeconds: 600,
  checkinWindowSeconds: 120,
  maxMissedCheckins: 2,
  autoAlertOnMissed: false,
  autoAlertOnOverdue: false,
  graceMinutes: 10,
  deviationThresholdM: 150,
  deviationResponseSeconds: 90,
  autoAlertOnDeviation: false,
  escalateAfterSeconds: 120,
  aiEnabled: true,
};

/** Observation freshness thresholds (days). Beyond OUTDATED_DAYS we label data "outdated". */
export const FRESH_DAYS = 30;
export const OUTDATED_DAYS = 90;
export const ASSIST_RADIUS_M = 250;
/** Contact link lifetime. Re-issuing a link resets this. */
export const CONTACT_LINK_DAYS = 30;
/** Hard cap: a journey that is never ended is closed (and access revoked) this long after ETA+grace. */
export const MAX_OVERRUN_HOURS = 6;

export const FORBIDDEN_CLAIMS = /(guaranteed (to be )?(safe|safety)|will guarantee|100 ?% (safe|secure)|(completely|totally|perfectly|absolutely|entirely) safe|will keep you safe|\b(route|path|street|area|option) is (safe|secure)\b|\b(safest|safer|unsafe|dangerous)\b|\bare safe\b|police (have|has) been (called|contacted|notified)|emergency services (have|has) been (called|contacted|notified)|ambulance (is|has been) (called|on the way))/i;

export const DISCLAIMER =
  'HerWay Beacon shows dated observations, not safety guarantees. It does not contact police or emergency services — call your local emergency number yourself if you are in danger.';
