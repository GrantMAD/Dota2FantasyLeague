import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'steamcdn-a.akamaihd.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'steamusercontent-a.akamaihd.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.steamusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.cloudflare.steamstatic.com',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
