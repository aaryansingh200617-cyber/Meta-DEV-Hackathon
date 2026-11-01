import { z } from 'zod';

export const placeSchema = z.object({
  name: z.string().trim().min(1).max(200),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  placeId: z.string().max(200).optional(),
  source: z.enum(['google', 'osrm', 'demo']).default('demo'),
});

export const modeSchema = z.enum(['walk', 'drive', 'transit']);

export const settingsSchema = z.object({
  retentionDays: z.number().int().refine((n) => n === -1 || (n >= 1 && n <= 3650), 'retentionDays must be -1 or 1–3650'),
  keepTrail: z.boolean(),
  emergencyNumber: z.string().trim().regex(/^[0-9+() -]{2,20}$/, 'Enter a valid phone number'),
  defaultCheckinSeconds: z.number().int().min(0).max(7200),
  checkinWindowSeconds: z.number().int().min(10).max(1800),
  maxMissedCheckins: z.number().int().min(1).max(10),
  autoAlertOnMissed: z.boolean(),
  autoAlertOnOverdue: z.boolean(),
  graceMinutes: z.number().int().min(0).max(120),
  deviationThresholdM: z.number().int().min(50).max(2000),
  deviationResponseSeconds: z.number().int().min(15).max(900),
  autoAlertOnDeviation: z.boolean(),
  escalateAfterSeconds: z.number().int().min(10).max(1800),
  aiEnabled: z.boolean(),
}).partial();

export const contactSchema = z.object({
  name: z.string().trim().min(1).max(80),
  relationship: z.string().trim().max(40).default(''),
  phone: z.string().trim().max(30).optional().or(z.literal('')),
  email: z.string().trim().email().max(120).optional().or(z.literal('')),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
});
