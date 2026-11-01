'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Wordmark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { FieldHint, Input, Label } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DemoButton } from '@/components/demo-button';
import { GoogleSignInButton } from '@/components/google-auth-button';
import { post, errMsg } from '@/lib/client/api';

export function AuthForm({
  mode,
  currentUser,
}: {
  mode: 'login' | 'register';
  currentUser?: { name: string; email: string } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [consent, setConsent] = React.useState(true);
  const reg = mode === 'register';

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (reg && !consent) {
      setError('Please accept the privacy notice to create an account.');
      return;
    }
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    try {
      await post(`/api/auth/${mode}`, { name: f.get('name'), email: f.get('email'), password: f.get('password'), consent });
      router.push('/app'); router.refresh();
    } catch (err) { setError(errMsg(err)); setBusy(false); }
  }

  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-surface px-3 py-6 sm:px-4 sm:py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Link href="/" aria-label="HerWay Beacon home"><Wordmark /></Link></div>
        <Card className="p-4 sm:p-8">
          {currentUser && (
            <div className="mb-5 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-xs text-slate-700">
              <div>
                <p className="font-semibold text-slate-900">Signed in as {currentUser.name}</p>
                <p className="text-[11px] text-slate-500">{currentUser.email}</p>
              </div>
              <Button asChild size="sm" variant="outline" className="rounded-lg text-xs bg-white hover:bg-slate-50">
                <Link href="/app">Dashboard</Link>
              </Button>
            </div>
          )}
          <h1 className="text-xl font-semibold">{reg ? 'Create your account' : 'Welcome back'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{reg ? 'Your data stays yours: export or delete it any time.' : 'Sign in to continue your journey.'}</p>

          <div className="mt-6 space-y-4">
            <GoogleSignInButton mode={mode} onError={(err) => setError(err)} />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <span>or continue with email</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          </div>

          <form onSubmit={submit} className="mt-4 space-y-4" noValidate={false}>
            {reg && <div><Label htmlFor="name">Your name</Label><Input id="name" name="name" autoComplete="name" required maxLength={80} /></div>}
            <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
            <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" autoComplete={reg ? 'new-password' : 'current-password'} required minLength={reg ? 8 : 1} />{reg && <FieldHint>At least 8 characters.</FieldHint>}</div>
            {reg && (
              <label className="flex items-start gap-3 rounded-xl bg-surface p-3 text-sm">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#1877F2]" required />
                <span>I understand that HerWay Beacon provides dated observations, not safety guarantees, does not contact emergency services, and I agree to the privacy notice: location is shared only with contacts I authorise, during active journeys.</span>
              </label>
            )}
            {error && <p role="alert" className="rounded-xl bg-destructive-soft px-3.5 py-2.5 text-sm text-destructive">{error}</p>}
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/95 text-white font-bold h-11 shadow-sm"
              size="lg"
              loading={busy}
            >
              {reg ? 'Create account' : 'Sign in'}
            </Button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
          <DemoButton variant="outline" className="w-full">Explore with a demo account</DemoButton>
        </Card>
        <p className="mt-5 text-center text-sm text-muted-foreground">
          {reg ? <>Already have an account? <Link className="font-medium text-primary hover:underline" href="/login">Sign in</Link></> : <>New here? <Link className="font-medium text-primary hover:underline" href="/register">Create an account</Link></>}
        </p>
      </div>
    </main>
  );
}
