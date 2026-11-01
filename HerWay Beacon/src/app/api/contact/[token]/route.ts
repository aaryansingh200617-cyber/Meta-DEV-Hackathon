import { route } from '@/lib/http';
import { resolveContactToken } from '@/lib/contact-token';
import { contactDashboard } from '@/lib/contact-view';
import { maybeTick } from '@/lib/engine';

/** Trusted-contact dashboard data. Authorised purely by the signed link; scope is re-checked on every call. */
export const GET = route<{ token: string }>(async (_req, { token }) => {
  void maybeTick().catch(() => {});
  const { contact, traveller } = await resolveContactToken(token);
  return contactDashboard(contact, traveller);
});
