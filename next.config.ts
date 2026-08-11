import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // En Next 16 dejó de ser experimental.
  typedRoutes: true,
};

export default nextConfig;
