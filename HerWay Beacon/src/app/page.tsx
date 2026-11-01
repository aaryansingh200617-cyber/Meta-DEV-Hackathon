import Link from 'next/link';
import {
  ArrowRight,
  Shield,
  ShieldCheck,
  Lock,
  Radio,
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  KeyRound,
  Database,
  Activity,
  UserCheck,
  Sparkles,
  Settings,
  ChevronRight,
  Check,
} from 'lucide-react';
import { Wordmark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { DemoButton } from '@/components/demo-button';
import { LandingRouteCompare } from '@/components/landing-route-compare';
import { currentUser } from '@/lib/auth';

export default async function Landing() {
  const user = await currentUser();

  return (
    <div className="min-h-dvh bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100 selection:text-primary">
      {/* Top Ambient Highlight */}
      <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400" />

      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="page flex h-16 items-center justify-between gap-2 sm:gap-4">
          <Wordmark />

          {/* Center Navigation Pills */}
          <nav className="hidden lg:flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50/80 px-3 py-1 shadow-xs">
            <Link
              href="#features"
              className="rounded-full px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900 hover:bg-white"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="rounded-full px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900 hover:bg-white"
            >
              How It Works
            </Link>
            <Link
              href="#safety-data"
              className="rounded-full px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900 hover:bg-white"
            >
              Safety Data
            </Link>
            <Link
              href="#testimonials"
              className="rounded-full px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900 hover:bg-white"
            >
              Testimonials
            </Link>
            <Link
              href="#about"
              className="rounded-full px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900 hover:bg-white"
            >
              About
            </Link>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {user && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                <Link href="/app">Dashboard</Link>
              </Button>
            )}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="rounded-xl px-2.5 sm:px-3 text-xs font-semibold text-slate-700 hover:text-slate-900"
            >
              <Link href="/login">Log In</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="rounded-xl bg-primary px-3 sm:px-4 text-xs font-bold text-white shadow-xs hover:bg-primary/95"
            >
              <Link href="/register">
                <span className="hidden xs:inline">Create Account</span>
                <span className="xs:hidden">Sign Up</span>
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-blue-50/50 via-white to-slate-50/30 pt-8 pb-12 sm:pt-20 sm:pb-24">
          <div className="page grid items-center gap-8 lg:gap-12 lg:grid-cols-[1.1fr_1fr]">
            {/* Left Column: Headlines & CTA */}
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                <Shield className="h-3.5 w-3.5 text-primary" />
                Women&apos;s Travel Companion
              </div>

              <h1 className="mt-4 sm:mt-5 text-3xl xs:text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.08] tracking-tight text-slate-900">
                Your Journey.
                <br />
                <span className="text-[#1877F2]">Your Choice.</span>
                <br />
                Your People.
              </h1>

              <p className="mt-4 sm:mt-5 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-lg">
                Compare routes using dated evidence, share your journey only with people you choose, and reach them fast
                when you need to — with access that ends the moment you arrive.
              </p>

              <div className="mt-6 sm:mt-8 flex flex-col xs:flex-row items-stretch xs:items-center gap-3">
                <Button
                  asChild
                  size="lg"
                  className="w-full xs:w-auto rounded-xl bg-primary px-6 font-bold text-white shadow-md hover:bg-primary/95"
                >
                  <Link href="/register">
                    Create Account <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                {user ? (
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="w-full xs:w-auto rounded-xl border-slate-300 bg-white px-6 font-bold text-slate-800 hover:bg-slate-50"
                  >
                    <Link href="/app">
                      Open Dashboard <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <DemoButton
                    size="lg"
                    variant="outline"
                    className="w-full xs:w-auto rounded-xl border-slate-300 bg-white px-6 font-bold text-slate-800 hover:bg-slate-50"
                  >
                    Try the demo ↗
                  </DemoButton>
                )}
              </div>

              <div className="mt-5 sm:mt-6 flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  The demo opens a private sandbox with sample contacts and clearly labelled simulated routes. No setup or GPS sync required.
                </span>
              </div>
            </div>

            {/* Right Column: Floating Live Telemetry Glass Card */}
            <div className="relative rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-7 shadow-xl shadow-blue-500/5">
              {/* Telemetry Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 sm:pb-4">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                    Telemetry Active
                  </span>
                </div>
                <span className="text-xs font-medium text-slate-400">Updated 2m ago</span>
              </div>

              {/* Route Summary */}
              <div className="mt-3.5 sm:mt-4 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Route B · Mixed roads</h3>
                  <p className="text-xs text-slate-500">via St. James Garden & North Promenade</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-sm font-bold text-slate-900">2.4 km</span>
                  <p className="text-xs text-slate-500">~31 min walk</p>
                </div>
              </div>

              {/* Segmented Visibility / Safety Bar */}
              <div className="mt-4 sm:mt-5">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 p-0.5">
                  <div className="h-full rounded-l-full bg-emerald-500 transition-all" style={{ width: '68%' }} />
                  <div className="h-full bg-amber-400 transition-all" style={{ width: '17%' }} />
                  <div className="h-full rounded-r-full bg-slate-300 transition-all" style={{ width: '15%' }} />
                </div>
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-y-1 text-[10px] sm:text-[11px] font-medium text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" /> High Visibility (68%)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-400" /> Aging (&lt;30 days)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-400" /> Missing Data (15%)
                  </span>
                </div>
              </div>

              {/* 3 Metric Cards */}
              <div className="mt-5 sm:mt-6 grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-2 sm:p-3 text-center">
                  <p className="text-lg sm:text-xl font-extrabold text-slate-900">68%</p>
                  <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-slate-500 leading-tight">Recent Street Data</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-2 sm:p-3 text-center">
                  <p className="text-lg sm:text-xl font-extrabold text-slate-900">17%</p>
                  <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-slate-500 leading-tight">Unsurveyed Alley</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-2 sm:p-3 text-center">
                  <p className="text-lg sm:text-xl font-extrabold text-emerald-600">5 Hubs</p>
                  <p className="mt-0.5 text-[10px] sm:text-[11px] font-medium text-slate-500 leading-tight">24/7 Verified Help</p>
                </div>
              </div>

              {/* Non-Prescriptive Principle Callout */}
              <div className="mt-4 sm:mt-5 rounded-2xl border border-blue-100 bg-blue-50/70 p-3 sm:p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#1877F2]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Non-Prescriptive Principle
                </div>
                <p className="mt-1 text-xs font-medium italic text-slate-700">
                  &ldquo;HerWay Beacon shows what was observed and when — it never scores a route as &apos;safe&apos;.&rdquo;
                </p>
              </div>

              {/* Ephemeral Circle Status */}
              <div className="mt-4 sm:mt-5 flex flex-col xs:flex-row xs:items-center justify-between gap-3 border-t border-slate-100 pt-3.5 sm:pt-4">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2 shrink-0">
                    <div className="h-7 w-7 rounded-full border-2 border-white bg-blue-600 text-[10px] font-bold text-white flex items-center justify-center">
                      AR
                    </div>
                    <div className="h-7 w-7 rounded-full border-2 border-white bg-emerald-600 text-[10px] font-bold text-white flex items-center justify-center">
                      ML
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">
                    <strong className="font-semibold text-slate-900">Ephemeral Access:</strong> 2 people receive your live status for this trip.
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 self-start xs:self-auto"
                >
                  Settings
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Step-by-Step Route Integrity (Evidence-Based Routing) */}
        <LandingRouteCompare />

        {/* Section 3: Engineered for Sovereignty (3 Pillars) */}
        <section id="features" className="border-t border-slate-200/80 bg-[#F8FAFC] py-16 sm:py-24">
          <div className="page">
            <div className="text-center max-w-2xl mx-auto">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Engineered for Sovereignty
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Safety Grounded in Reality, Not Perception
              </h2>
              <p className="mt-3 text-base text-slate-600">
                Designed from the ground up for women, night commuters, and solo travellers. No vanity metrics. No marketing fluff.
              </p>
            </div>

            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {/* Pillar 1 */}
              <div className="flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-7 shadow-xs">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-primary">
                    <FileCheck2 className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-slate-900">
                    Objective Observation over Subjective Ratings
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                    Superficial star ratings fall flat. We substitute utility with hard evidence: municipal fixtures, active night stores, operational emergency gates, and verified transit staff.
                  </p>
                </div>
                <div className="mt-8 rounded-xl bg-slate-50 border border-slate-100 p-2.5 flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span>100% data-stamped field discovery</span>
                </div>
              </div>

              {/* Pillar 2 */}
              <div className="flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-7 shadow-xs">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                    <Lock className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-slate-900">
                    Ephemeral Circle Sharing
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                    You should never have to surrender permanent privacy for personal safety. Share real-time coordinates, path deviations, and battery levels exclusively with chosen people — auto-revoked the minute your trip concludes.
                  </p>
                </div>
                <div className="mt-8 rounded-xl bg-slate-50 border border-slate-100 p-2.5 flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <Lock className="h-4 w-4 text-indigo-600" />
                  <span>Self-terminating cryptographic keys</span>
                </div>
              </div>

              {/* Pillar 3 */}
              <div className="flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-white p-7 shadow-xs">
                <div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                    <Radio className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-bold text-slate-900">
                    Rapid Escalation Beacon
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
                    One-tap transmits high-urgency SMS and audio alerts to your trusted inner-circle. Sends exact breadcrumbs, nearest lighted landmark, and battery life without clumsy lock-screen navigation.
                  </p>
                </div>
                <div className="mt-8 rounded-xl bg-slate-50 border border-slate-100 p-2.5 flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <Activity className="h-4 w-4 text-rose-600" />
                  <span>Sub-second relay to emergency contacts</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Real Commuter Trust (Testimonials & Night Visuals) */}
        <section id="testimonials" className="border-t border-slate-200/80 bg-white py-16 sm:py-24">
          <div className="page">
            <div className="max-w-xl">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Real Commuter Trust
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                Designed with people who walk alone after midnight
              </h2>
              <p className="mt-3 text-base text-slate-600">
                Hear from shift workers, solo travelers, and students who replaced anxious checking with deterministic situational awareness.
              </p>
            </div>

            <div className="mt-12 grid items-center gap-10 lg:grid-cols-2">
              {/* Left: Atmospheric Photography & Metric Badge */}
              <div className="relative">
                <div className="grid grid-cols-2 gap-4">
                  {/* Night Lit Route Image */}
                  <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-slate-900 shadow-md">
                    <img
                      src="/images/night-walker-lamps.png"
                      alt="Woman walking at night along a path lit by street lamps"
                      className="h-full w-full object-cover object-center opacity-95 transition-transform duration-300 hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <span className="inline-block rounded-full bg-white/20 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        24/7 Verified Hubs
                      </span>
                    </div>
                  </div>

                  {/* Night Commuter Navigation Image */}
                  <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-slate-900 shadow-md translate-y-6">
                    <img
                      src="/images/night-commuter-phone.jpg"
                      alt="Solo traveler using phone for real-time navigation at night"
                      className="h-full w-full object-cover object-top opacity-95 transition-transform duration-300 hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <span className="inline-block rounded-full bg-white/20 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        Arterial Walkways
                      </span>
                    </div>
                  </div>
                </div>

                {/* Floating Metric Card Overlay */}
                <div className="mt-4 sm:absolute sm:-bottom-4 sm:left-6 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-md p-3.5 sm:p-4 shadow-xl">
                  <p className="text-xl sm:text-2xl font-extrabold text-slate-900">16,200+</p>
                  <p className="text-xs font-semibold text-slate-700">Active interventions triggered in 2026</p>
                  <p className="text-[11px] text-slate-400">Across 14 metro zones</p>
                </div>
              </div>

              {/* Right: Testimonial Quotes */}
              <div className="flex flex-col gap-6 lg:pl-6">
                {/* Testimonial 1 */}
                <div className="rounded-3xl border border-slate-200/90 bg-[#F8FAFC] p-7 shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      AR
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">Dr. Ananya Roy</h4>
                      <p className="text-xs font-medium text-slate-500">
                        ER Resident, Trauma Center • Night Shift Transit
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-slate-700 italic">
                    &ldquo;Other apps sent me down an alley near &apos;Luke&apos; with no explanation. HerWay showed me that the streetlamps had been dead since Tuesday, so I took the commercial route instead. That distinction makes all the difference.&rdquo;
                  </p>
                </div>

                {/* Testimonial 2 */}
                <div className="rounded-3xl border border-slate-200/90 bg-[#F8FAFC] p-7 shadow-xs">
                  <div className="flex items-center gap-3.5">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                      ML
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">Maya Lin</h4>
                      <p className="text-xs font-medium text-slate-500">
                        Graduate Researcher • Evening Campus Commute
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-slate-700 italic">
                    &ldquo;The temporary sharing gives my partner peace of mind without me feeling monitored 24/7. As soon as I swipe my campus apartment door, the sharing link closes automatically.&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: Uncompromising Privacy (How We Guard Data Integrity) */}
        <section id="how-it-works" className="border-t border-slate-200/80 bg-[#F8FAFC] py-16 sm:py-24">
          <div className="page">
            <div className="text-center max-w-xl mx-auto">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Uncompromising Privacy
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                How We Guard Data Integrity
              </h2>
              <p className="mt-3 text-base text-slate-600">
                Built on zero-knowledge principles, cryptographic ephemerality, and open transparency audits.
              </p>
            </div>

            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {/* Integrity 1 */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-primary">
                  <KeyRound className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-bold text-slate-900">End-to-End Tunnel</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Your route coordinates stream directly to your circle&apos;s devices using asymmetric transit keys.
                </p>
              </div>

              {/* Integrity 2 */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Database className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-bold text-slate-900">Zero Data Permanence</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Telemetry stream is pruned in real-time; only the sender retains past data after session closure.
                </p>
              </div>

              {/* Integrity 3 */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-bold text-slate-900">Peer-Verified Audits</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Physical audits and road data updates undergo multi-source sign-off by local community hosts.
                </p>
              </div>

              {/* Integrity 4 */}
              <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                  <Activity className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-bold text-slate-900">Fail-Safe Ping</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Autonomous heartbeat ensures that sudden loss of carrier signal is flagged as potential deviation.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Bottom Hero Banner CTA */}
        <section id="about" className="py-12 sm:py-24">
          <div className="page">
            <div
              style={{ background: 'linear-gradient(135deg, #1877F2 0%, #0d47a1 100%)' }}
              className="relative overflow-hidden rounded-3xl p-5 sm:p-12 lg:p-16 text-white shadow-xl"
            >
              {/* Subtle background radial light */}
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 15% 40%, white 1.5px, transparent 1.5px), radial-gradient(circle at 85% 60%, white 1.5px, transparent 1.5px)',
                  backgroundSize: '48px 48px',
                }}
              />

              <div className="relative max-w-2xl">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-semibold backdrop-blur-md">
                  <Shield className="h-3.5 w-3.5" />
                  Private Navigation Companion
                </div>

                <h2 className="mt-4 sm:mt-5 text-2xl xs:text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
                  Travel with clarity, not guesswork.
                </h2>

                <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-white/80 leading-relaxed">
                  Inspect real street facts, keep your circle informed, and retain total control of your digital footprint from start to finish.
                </p>

                <div className="mt-6 sm:mt-8 flex flex-col xs:flex-row items-stretch xs:items-center gap-3">
                  <DemoButton
                    size="lg"
                    className="w-full xs:w-auto rounded-xl bg-white px-7 font-bold text-[#1877F2] shadow-lg hover:bg-white/95 border-0"
                  >
                    Launch Interactive Demo
                  </DemoButton>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="w-full xs:w-auto rounded-xl border-white/30 bg-white/10 px-6 font-bold text-white hover:bg-white/20 hover:text-white"
                  >
                    <Link href="#safety-data">Explore Hardware Sources</Link>
                  </Button>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-6 text-xs text-white/70">
                  <span className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-white" /> No registration required for demo
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-white" /> Zero battery-draining background listeners
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="page flex flex-col gap-4 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Wordmark />
            <span>· Safe Commute Engine · © {new Date().getFullYear()}</span>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <Link href="#features" className="hover:text-slate-900 transition-colors">
              Features
            </Link>
            <Link href="#safety-data" className="hover:text-slate-900 transition-colors">
              Evidence Routing
            </Link>
            <Link href="#how-it-works" className="hover:text-slate-900 transition-colors">
              Data Sovereignty
            </Link>
            <Link href="/login" className="hover:text-slate-900 transition-colors">
              Log In
            </Link>
            <Link href="/register" className="hover:text-slate-900 transition-colors">
              Create Account
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
