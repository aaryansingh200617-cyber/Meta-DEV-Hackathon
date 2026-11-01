'use client';

import * as React from 'react';
import Link from 'next/link';
import { Menu, X, ArrowRight } from 'lucide-react';
import { Wordmark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#safety-data', label: 'Safety Data' },
  { href: '#testimonials', label: 'Testimonials' },
  { href: '#about', label: 'About' },
];

export function LandingNavbar({ user }: { user?: { name?: string } | null }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      {/* Top Ambient Highlight */}
      <div className="h-1 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-sky-400" />

      <div className="page relative flex h-16 items-center justify-between gap-3">
        {/* Left: Brand Logo + Wordmark */}
        <Link href="/" className="transition-opacity hover:opacity-90 shrink-0">
          <Wordmark />
        </Link>

        {/* Center: Mathematically Centered Navigation Pill for Desktop */}
        <nav
          className="hidden lg:flex absolute left-1/2 -translate-x-1/2 items-center gap-0.5 rounded-full border border-slate-200/90 bg-white/90 p-1 shadow-xs backdrop-blur-md"
          aria-label="Main Navigation"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-3.5 py-1.5 text-[13px] font-medium text-slate-600 transition-all hover:bg-slate-100 hover:text-slate-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right: Actions + Mobile Menu Toggle */}
        <div className="flex items-center gap-2">
          {user ? (
            <Button
              asChild
              size="sm"
              className="rounded-xl bg-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-primary/95"
            >
              <Link href="/app">
                Dashboard <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              >
                <Link href="/login">Log In</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="rounded-xl bg-primary px-3.5 sm:px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-primary/95"
              >
                <Link href="/register">
                  <span className="hidden xs:inline">Create Account</span>
                  <span className="xs:hidden">Sign Up</span>
                </Link>
              </Button>
            </>
          )}

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden ml-1 inline-flex items-center justify-center rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none"
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Dropdown */}
      {mobileOpen && (
        <div className="border-t border-slate-200/80 bg-white/98 px-4 py-4 shadow-lg backdrop-blur-md lg:hidden">
          <nav className="flex flex-col space-y-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
            {!user && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-1/2 rounded-xl text-xs font-semibold"
                onClick={() => setMobileOpen(false)}
              >
                <Link href="/login">Log In</Link>
              </Button>
            )}
            <Button
              asChild
              size="sm"
              className={cn('rounded-xl text-xs font-bold', user ? 'w-full' : 'w-1/2')}
              onClick={() => setMobileOpen(false)}
            >
              <Link href={user ? '/app' : '/register'}>
                {user ? 'Open Dashboard' : 'Create Account'}
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
