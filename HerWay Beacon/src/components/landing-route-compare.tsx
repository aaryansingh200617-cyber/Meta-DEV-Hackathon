'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check, AlertTriangle, ShieldCheck, Clock, ArrowRight, Eye, Shield, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DemoButton } from '@/components/demo-button';
import { cn } from '@/lib/utils';

export function LandingRouteCompare() {
  const [filter, setFilter] = React.useState<'night' | 'lit'>('night');
  const [selectedRoute, setSelectedRoute] = React.useState<'A' | 'B'>('A');

  return (
    <section id="safety-data" className="border-t border-slate-200/80 bg-white py-16 sm:py-24">
      <div className="page">
        {/* Header with Filters */}
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary border border-blue-100">
              <Eye className="h-3.5 w-3.5" />
              Step-by-Step Route Integrity
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
              Evidence-Based Routing: No Blind Faith
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Traditional apps guide you through the shortest street path, ignoring dark alleys and broken streetlights. HerWay records the actual state of the pavement.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-end mt-3 md:mt-0">
            <span className="text-xs font-semibold text-slate-500">Filter context:</span>
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100/80 p-0.5 sm:p-1">
              <button
                type="button"
                onClick={() => setFilter('night')}
                className={cn(
                  'rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold transition-all',
                  filter === 'night'
                    ? 'bg-[#0B1F3A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                Night Transit (21:00+)
              </button>
              <button
                type="button"
                onClick={() => setFilter('lit')}
                className={cn(
                  'rounded-lg px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-semibold transition-all',
                  filter === 'lit'
                    ? 'bg-[#0B1F3A] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900',
                )}
              >
                Well-Lit Only
              </button>
            </div>
          </div>
        </div>

        {/* 2 Comparative Route Cards */}
        <div className="mt-8 sm:mt-10 grid gap-6 lg:grid-cols-2">
          {/* Card 1: Route A - High Visibility */}
          <div
            className={cn(
              'relative flex flex-col justify-between rounded-3xl border-2 bg-white p-4 sm:p-6 sm:p-8 transition-all shadow-sm',
              selectedRoute === 'A'
                ? 'border-emerald-500 shadow-md shadow-emerald-500/5 ring-1 ring-emerald-500/20'
                : 'border-slate-200/90 hover:border-slate-300',
            )}
          >
            <div>
              {/* Badge & Timestamp */}
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  High Visibility
                </span>
                <span className="text-xs font-medium text-slate-400">Observed today, 18:42</span>
              </div>

              {/* Title & Description */}
              <h3 className="mt-4 text-xl font-bold text-slate-900">Route A: West Parkside Ave</h3>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                Wide pedestrian boulevard, active storefronts, and 4 municipal emergency call-boxes along the path.
              </p>

              {/* Verified Progress Bar */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700">Continuous street illumination</span>
                  <span className="text-emerald-700 font-bold">96% Verified</span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                    style={{ width: '96%' }}
                  />
                </div>
              </div>

              {/* Feature Chips */}
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50/80 px-2.5 py-1 text-xs font-medium text-emerald-800 border border-emerald-100">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> 4 Badges Open
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50/80 px-2.5 py-1 text-xs font-medium text-emerald-800 border border-emerald-100">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> Multi-CCTV Path
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50/80 px-2.5 py-1 text-xs font-medium text-emerald-800 border border-emerald-100">
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> 3 Shelters
                </span>
              </div>
            </div>

            {/* Footer with Duration & Action */}
            <div className="mt-6 sm:mt-8 flex flex-col xs:flex-row xs:items-center justify-between gap-3 border-t border-slate-100 pt-4 sm:pt-5">
              <div>
                <span className="text-base font-bold text-slate-900">26 min</span>
                <span className="ml-1.5 text-xs font-medium text-slate-500">+150m (arterial)</span>
              </div>
              <Button
                type="button"
                onClick={() => setSelectedRoute('A')}
                className={cn(
                  'w-full xs:w-auto rounded-xl px-5 text-xs font-bold transition-all',
                  selectedRoute === 'A'
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                )}
              >
                {selectedRoute === 'A' ? 'Selected Route A' : 'Select Route A'}
              </Button>
            </div>
          </div>

          {/* Card 2: Route B - Outdated Sections */}
          <div
            className={cn(
              'relative flex flex-col justify-between rounded-3xl border-2 bg-white p-4 sm:p-6 sm:p-8 transition-all shadow-sm',
              selectedRoute === 'B'
                ? 'border-rose-400 shadow-md shadow-rose-500/5 ring-1 ring-rose-500/20'
                : 'border-slate-200/90 hover:border-slate-300',
            )}
          >
            <div>
              {/* Badge & Timestamp */}
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 border border-rose-200">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                  Outdated Sections
                </span>
                <span className="text-xs font-medium text-slate-400">Last inspection 124d ago</span>
              </div>

              {/* Title & Description */}
              <h3 className="mt-4 text-xl font-bold text-slate-900">Route B: Industrial Connector Alley</h3>
              <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                Shorter, vegetative absence, low pedestrian density with 3 non-functioning fixtures.
              </p>

              {/* Verified Progress Bar */}
              <div className="mt-6">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700">Dark / broken fixture zones</span>
                  <span className="text-rose-600 font-bold">44% Verified</span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-rose-500 to-amber-500 transition-all duration-500"
                    style={{ width: '44%' }}
                  />
                </div>
              </div>

              {/* Warning Chips */}
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50/80 px-2.5 py-1 text-xs font-medium text-rose-800 border border-rose-100">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" /> 2 Lamp Outages flagged
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50/80 px-2.5 py-1 text-xs font-medium text-amber-800 border border-amber-100">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Construction Fencing
                </span>
              </div>
            </div>

            {/* Footer with Duration & Action */}
            <div className="mt-6 sm:mt-8 flex flex-col xs:flex-row xs:items-center justify-between gap-3 border-t border-slate-100 pt-4 sm:pt-5">
              <div>
                <span className="text-base font-bold text-slate-900">19 min</span>
                <span className="ml-1.5 text-xs font-medium text-slate-500">-4m (Fastest)</span>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedRoute('B')}
                className="w-full xs:w-auto rounded-xl border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Inspect Gaps
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

