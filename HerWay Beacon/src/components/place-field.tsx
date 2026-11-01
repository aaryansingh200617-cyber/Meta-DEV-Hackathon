'use client';
import * as React from 'react';
import { Crosshair, Loader2, MapPin } from 'lucide-react';
import { Input, Label } from '@/components/ui/input';
import { api } from '@/lib/client/api';
import type { Place } from '@/lib/types';
import { cn } from '@/lib/utils';

export function PlaceField({
  label,
  value,
  onChange,
  allowLocate,
  placeholder,
  id,
}: {
  label: string;
  value: Place | null;
  onChange: (p: Place | null) => void;
  allowLocate?: boolean;
  placeholder?: string;
  id: string;
}) {
  const [text, setText] = React.useState(value?.name ?? '');
  const [options, setOptions] = React.useState<Place[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [geoErr, setGeoErr] = React.useState<string | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Sync with controlled value
  React.useEffect(() => {
    setText(value?.name ?? '');
  }, [value]);

  // Robust click-outside handler: keeps dropdown stable until user clicks outside
  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function search(q: string) {
    setText(q);
    if (value && q !== value.name) onChange(null);

    clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setOptions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setOpen(true);

    timer.current = setTimeout(async () => {
      try {
        const res = await api<{ places: Place[] }>(`/api/places?q=${encodeURIComponent(q.trim())}`);
        setOptions(res.places ?? []);
        setOpen(true);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 120);
  }

  function handleSelect(p: Place) {
    onChange(p);
    setText(p.name);
    setOpen(false);
  }

  function locate() {
    setGeoErr(null);
    if (!navigator.geolocation) {
      setGeoErr('Location is not available on this device.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        onChange({
          name: 'My current location',
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          source: 'osrm',
        });
        setBusy(false);
      },
      () => {
        setGeoErr('Could not get your location. Check browser permission, or type a place.');
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id={id}
          value={text}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          className={cn('pl-10', (allowLocate || loading) && 'pr-11')}
          onChange={(e) => search(e.target.value)}
          onFocus={() => {
            if (options.length > 0 || text.trim().length >= 2) {
              setOpen(true);
              if (!options.length) search(text);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'Enter' && options.length > 0 && open) {
              e.preventDefault();
              handleSelect(options[0]!);
            }
          }}
        />

        {/* Loading spinner or locate button */}
        {loading ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        ) : allowLocate ? (
          <button
            type="button"
            onClick={locate}
            disabled={busy}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-primary hover:bg-primary-soft disabled:opacity-50"
            aria-label="Use my current location"
            title="Use my current location"
          >
            <Crosshair className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* Suggestion Dropdown: click will NEVER get swallowed */}
      {open && (options.length > 0 || loading) && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-xl border bg-background p-1 shadow-xl backdrop-blur-md"
        >
          {options.map((p) => (
            <li key={`${p.placeId ?? p.name}`} role="option" aria-selected={value?.name === p.name}>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus:bg-muted"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(p);
                }}
                onClick={() => handleSelect(p)}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate font-medium">{p.name}</span>
              </button>
            </li>
          ))}
          {loading && options.length === 0 && (
            <li className="px-3 py-2 text-xs text-muted-foreground">Searching places...</li>
          )}
        </ul>
      )}

      {geoErr && <p className="mt-1.5 text-xs text-destructive">{geoErr}</p>}
    </div>
  );
}
