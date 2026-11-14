import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['*.ngrok-free.app'],
  // L'export della pipeline viene letto a runtime come fallback del database
  outputFileTracingIncludes: {
    '/api/venues': ['./data/processed/venues.json'],
    '/api/venues/[id]': ['./data/processed/venues.json'],
  },
  // Confini di Municipi e quartieri (1 MB): cambiano di rado, il telefono li tiene un giorno
  async headers() {
    return [{ source: '/geo/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] }];
  },
  async redirects() {
    return [
      { source: '/map', destination: '/mappa', permanent: true },
      // La Home stava su /home: link salvati e app installate non devono finire su un 404
      { source: '/home', destination: '/inizio', permanent: true },
      { source: '/leaderboard', destination: '/', permanent: true },
      { source: '/virtual-tour', destination: '/', permanent: true },
      { source: '/onboarding', destination: '/auth', permanent: true },
      { source: '/profile', destination: '/profilo', permanent: false },
      { source: '/profile/account', destination: '/profilo/account', permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
    ],
  },
};

export default nextConfig;
