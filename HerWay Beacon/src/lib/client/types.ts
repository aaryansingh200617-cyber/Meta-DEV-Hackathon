import type { journeyView } from '../journeys';
import type { relayDetail } from '../relay';
import type { contactDashboard } from '../contact-view';
import type { presentContact } from '../account';
import type { IntegrationStatus } from '../env';

export type JourneyView = Awaited<ReturnType<typeof journeyView>>;
export type RelayDetail = Awaited<ReturnType<typeof relayDetail>>;
export type ContactDash = Awaited<ReturnType<typeof contactDashboard>>;
export type ContactDTO = ReturnType<typeof presentContact>;
export type Status = IntegrationStatus;
export interface HistoryItem {
  id: string; status: string; mode: string; origin: string; destination: string; startedAt: string; endedAt: string | null; endReason: string | null;
  routeLabel: string; distanceM: number; simulated: boolean; purgeAfter: string | null; sharedWith: string[];
  counts: { relays: number; confirmed: number; missed: number };
}
