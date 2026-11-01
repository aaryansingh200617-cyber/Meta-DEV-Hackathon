import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Location + microphone only for this origin (journey GPS, voice input)
  { key: 'Permissions-Policy', value: 'geolocation=(self), microphone=(self), camera=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
];

const nextConfig = {
  output: 'standalone',
  devIndicators: false,
  outputFileTracingRoot: __dirname,
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['web-push', 'mongodb'],
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Contact links carry a bearer token in the URL: never leak it via Referer, never cache.
      {
        source: '/c/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Cache-Control', value: 'no-store' },
        ],
      },
      { source: '/api/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};

export default nextConfig;
