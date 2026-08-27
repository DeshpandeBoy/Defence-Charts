import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
];

/** @type {import('next').NextConfig} */
const config = {
  agentRules: false,
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@shiftcharts/core', '@shiftcharts/primitives', '@shiftcharts/react'],
  headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default withMDX(config);
