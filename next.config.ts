import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['*.ngrok-free.app'],
  // L'export della pipeline viene letto a runtime come fallback del database
  outputFileTracingIncludes: {
    '/api/venues': ['./data/processed/venues.json'],
    '/api/venues/[id]': ['./data/processed/venues.json'],
  },
  async redirects() {
    return [
      { source: '/map', destination: '/', permanent: true },
      { source: '/home', destination: '/', permanent: true },
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
