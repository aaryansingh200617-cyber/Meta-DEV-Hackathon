'use client';
import * as React from 'react';
import { Check, Copy, ExternalLink, Link2, Pencil, Plus, RefreshCw, Share2, ShieldOff, Trash2, UserPlus, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { FieldHint, Input, Label, Select } from '@/components/ui/input';
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from '@/components/common';
import { useToast } from '@/components/toast';
import { api, del, errMsg, patch, post } from '@/lib/client/api';
import { usePoll } from '@/hooks/use-poll';
import type { ContactDTO } from '@/lib/client/types';
import { fmtDateTime, initials } from '@/lib/utils';

const TIERS = { 1: 'Circle 1 · first to be alerted', 2: 'Circle 2 · alerted if no reply', 3: 'Circle 3 · final backup' } as const;
const STATUS: Record<string, { v: 'success' | 'warning' | 'danger' | 'neutral'; t: string }> = { accepted: { v: 'success', t: 'Accepted' }, pending: { v: 'warning', t: 'Invitation pending' }, declined: { v: 'neutral', t: 'Declined' }, revoked: { v: 'danger', t: 'Access withdrawn' } };

export function ContactsClient() {
  const toast = useToast();
  const q = usePoll(() => api<{ contacts: ContactDTO[] }>('/api/contacts'), 6000);
  const [edit, setEdit] = React.useState<ContactDTO | 'new' | null>(null);
  const [linkFor, setLinkFor] = React.useState<ContactDTO | null>(null);
  const contacts = q.data?.contacts ?? [];
  const listEndRef = React.useRef<HTMLDivElement>(null);

  async function revoke(c: ContactDTO) {
    if (!confirm(`Withdraw ${c.name}'s access everywhere, immediately? Their link will stop working.`)) return;
    try { await post(`/api/contacts/${c.id}/revoke`); toast({ tone: 'success', title: `${c.name}'s access withdrawn` }); q.refresh(); } catch (e) { toast({ tone: 'error', title: 'Could not withdraw access', body: errMsg(e) }); }
  }
  async function remove(c: ContactDTO) {
    if (!confirm(`Remove ${c.name} from your circle? Their access ends immediately.`)) return;
    try { await del(`/api/contacts/${c.id}`); toast({ tone: 'success', title: 'Contact removed' }); q.refresh(); } catch (e) { toast({ tone: 'error', title: 'Could not remove', body: errMsg(e) }); }
  }

  return (
    <>
      <PageHeader title="Trusted contacts" subtitle="People you choose. They only see what you share for each journey, and only after they accept." actions={<Button onClick={() => setEdit('new')}><Plus className="h-4 w-4" />Add contact</Button>} />
      {q.loading && !q.data ? <ListSkeleton /> : q.error && !q.data ? <ErrorState error={q.error} onRetry={q.refresh} /> : contacts.length === 0 ? (
        <EmptyState icon={Users} title="Your circle is empty" body="Add a sister, friend or parent you'd trust to pick up. They'll get a private link to accept the role — no account needed." action={<Button onClick={() => setEdit('new')}><UserPlus className="h-4 w-4" />Add your first contact</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {contacts.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-full bg-primary-soft font-semibold text-primary">{initials(c.name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2"><p className="font-semibold">{c.name}</p><Badge variant={STATUS[c.status]!.v} className="text-[10px] sm:text-xs">{STATUS[c.status]!.t}</Badge></div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{c.relationship || 'Contact'} · {TIERS[c.tier]}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{c.phone ?? 'No phone'}{c.email ? ` · ${c.email}` : ''}</p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-1 xs:grid-cols-2 gap-2 sm:gap-3 rounded-xl bg-surface p-2.5 sm:p-3 text-xs">
                  <div><dt className="text-muted-foreground">Consent given</dt><dd className="mt-0.5 font-medium">{c.consentedAt ? fmtDateTime(c.consentedAt) : '—'}</dd></div>
                  <div><dt className="text-muted-foreground">Link expires</dt><dd className="mt-0.5 font-medium">{fmtDateTime(c.tokenExpiresAt)}</dd></div>
                  <div className="xs:col-span-2"><dt className="text-muted-foreground">Notifications</dt><dd className="mt-0.5 font-medium">{c.pushDevices ? `Push enabled on ${c.pushDevices} device${c.pushDevices === 1 ? '' : 's'}` : 'In-app only (contact has not enabled push)'}</dd></div>
                </dl>
                <div className="mt-4 flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <Button size="sm" variant="outline" className="flex-1 xs:flex-initial" onClick={() => setLinkFor(c)}><Link2 className="h-4 w-4" />{c.status === 'pending' ? 'Send invitation' : 'Access link'}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEdit(c)}><Pencil className="h-4 w-4" />Edit</Button>
                  {c.status === 'accepted' && <Button size="sm" variant="ghost" onClick={() => revoke(c)}><ShieldOff className="h-4 w-4" />Withdraw</Button>}
                  <Button size="sm" variant="ghost" className="ml-auto text-destructive hover:bg-destructive-soft" onClick={() => remove(c)} aria-label={`Remove ${c.name}`}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {/* Scroll target for newly added contacts */}
          <div ref={listEndRef} />
        </div>
      )}
      <ContactForm
        value={edit}
        onClose={() => setEdit(null)}
        onSaved={() => {
          setEdit(null);
          q.refresh().then(() => {
            // Scroll to end of list so the new contact is visible
            setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 100);
          }).catch(() => undefined);
        }}
      />
      <LinkDialog contact={linkFor} onClose={() => { setLinkFor(null); q.refresh(); }} />
    </>
  );
}

function ContactForm({ value, onClose, onSaved }: { value: ContactDTO | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const isNew = value === 'new';
  const c = value && value !== 'new' ? value : null;
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = { name: f.get('name'), relationship: f.get('relationship'), phone: f.get('phone'), email: f.get('email'), tier: Number(f.get('tier')) };
    setBusy(true);
    try { if (isNew) await post('/api/contacts', body); else await patch(`/api/contacts/${c!.id}`, body); toast({ tone: 'success', title: isNew ? 'Contact added' : 'Contact updated', body: isNew ? 'Now send them the invitation link so they can accept.' : undefined }); onSaved(); }
    catch (err) { toast({ tone: 'error', title: 'Could not save', body: errMsg(err) }); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={!!value} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={isNew ? 'Add a trusted contact' : 'Edit contact'} description="Phone and email are encrypted at rest and only used to notify this person.">
        <form key={c?.id ?? 'new'} onSubmit={submit} className="space-y-4">
          <div><Label htmlFor="cn">Name</Label><Input id="cn" name="name" defaultValue={c?.name} required maxLength={80} autoComplete="off" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="cr">Relationship</Label><Input id="cr" name="relationship" defaultValue={c?.relationship} placeholder="Sister, friend…" maxLength={40} /></div>
            <div><Label htmlFor="ct">Circle</Label><Select id="ct" name="tier" defaultValue={c?.tier ?? 1}>{([1, 2, 3] as const).map((t) => <option key={t} value={t}>{TIERS[t]}</option>)}</Select></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label htmlFor="cp">Phone</Label><Input id="cp" name="phone" type="tel" defaultValue={c?.phone ?? ''} autoComplete="off" /></div>
            <div><Label htmlFor="ce">Email</Label><Input id="ce" name="email" type="email" defaultValue={c?.email ?? ''} autoComplete="off" /></div>
          </div>
          <FieldHint>Circle 1 is alerted first. If nobody acknowledges in time, Circle 2 is alerted, then Circle 3.</FieldHint>
          <Button type="submit" size="lg" className="w-full" loading={busy}>{isNew ? 'Add contact' : 'Save changes'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LinkDialog({ contact, onClose }: { contact: ContactDTO | null; onClose: () => void }) {
  const toast = useToast();
  const [url, setUrl] = React.useState<string | null>(null);
  const [linkLoading, setLinkLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setUrl(null); setCopied(false);
    if (contact) {
      setLinkLoading(true);
      api<{ url: string | null }>(`/api/contacts/${contact.id}/link`)
        .then((r) => setUrl(r.url))
        .catch((e) => toast({ tone: 'error', title: 'Could not load link', body: errMsg(e) }))
        .finally(() => setLinkLoading(false));
    }
  }, [contact, toast]);

  async function rotate() {
    if (!contact) return;
    if (!confirm('Issue a new link? The old link will stop working immediately.')) return;
    setBusy(true);
    try {
      const r = await post<{ url: string }>(`/api/contacts/${contact.id}/link`);
      setUrl(r.url);
      toast({ tone: 'success', title: 'New link issued', body: 'Previous links no longer work.' });
    } catch (e) {
      toast({ tone: 'error', title: 'Failed', body: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  async function acceptOnBehalf() {
    if (!contact || !url) return;
    const token = url.split('/c/')[1];
    if (!token) return;
    setBusy(true);
    try {
      await post(`/api/contact/${token}/respond`, { decision: 'accept' });
      toast({ tone: 'success', title: `${contact.name} accepted!`, body: 'They can now receive live updates and follow your journeys.' });
      onClose();
    } catch (e) {
      toast({ tone: 'error', title: 'Could not accept', body: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }

  // Improved invitation text with both app names
  const text = contact && url
    ? `Hi ${contact.name}, I'd like you to be one of my trusted safety contacts on Saheli Journey (HerWay Beacon). This means you can see my journey status when I share it with you — only while I'm travelling, and only what I choose. No account needed — just tap this link to accept: ${url}`
    : '';

  const whatsappUrl = text ? `https://wa.me/?text=${encodeURIComponent(text)}` : '';

  return (
    <Dialog open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={`Access link for ${contact?.name ?? ''}`} description="This private link is how they accept, see shared journeys and acknowledge help requests. Share it only with them.">
        {linkLoading ? (
          /* Proper loading spinner instead of plain "Loading…" */
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
            Loading link…
          </div>
        ) : url ? (
          <>
            <div className="break-all rounded-xl border bg-surface p-2.5 sm:p-3 font-mono text-xs">{url}</div>
            <div className="flex flex-col xs:flex-row xs:flex-wrap gap-2">
              <Button variant="outline" className="w-full xs:w-auto" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy link'}
              </Button>
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <Button variant="outline" className="w-full xs:w-auto" onClick={() => navigator.share({ text }).catch(() => undefined)}>
                  <Share2 className="h-4 w-4" />Share…
                </Button>
              )}
              {/* WhatsApp share button */}
              {whatsappUrl && (
                <Button variant="outline" className="w-full xs:w-auto" asChild>
                  <a href={whatsappUrl} target="_blank" rel="noreferrer">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.125.555 4.122 1.524 5.859L.057 23.428a.5.5 0 0 0 .608.61l5.703-1.498A11.944 11.944 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.885 0-3.642-.518-5.145-1.417l-.368-.219-3.815 1.001 1.019-3.727-.24-.383A9.938 9.938 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                    </svg>
                    WhatsApp
                  </a>
                </Button>
              )}
              <Button className="w-full xs:w-auto" asChild>
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />Open as {contact?.name.split(' ')[0]}
                </a>
              </Button>
              {contact?.status === 'pending' && (
                <Button variant="outline" className="w-full xs:w-auto border-emerald-500/50 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800" onClick={acceptOnBehalf} loading={busy}>
                  <Check className="h-4 w-4 text-emerald-600" />Accept now (Demo)
                </Button>
              )}
            </div>
            <p className="rounded-xl bg-warning-soft p-3 text-xs text-warning">HerWay Beacon can't send SMS or email in this build, so you share the link yourself. "Open as" previews exactly what your contact sees.</p>
            <Button variant="ghost" size="sm" onClick={rotate} loading={busy}><RefreshCw className="h-4 w-4" />Issue a new link (invalidates the old one)</Button>
          </>
        ) : contact?.status === 'revoked' || contact?.status === 'declined' ? (
          <>
            <p className="text-sm text-muted-foreground">This contact's access is {contact.status}. Re-inviting issues a new link and requires them to consent again.</p>
            <Button onClick={rotate} loading={busy}>Re-invite</Button>
          </>
        ) : (
          /* Empty state while link is null but not explicitly loading — shouldn't normally be reached */
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
            Loading link…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
