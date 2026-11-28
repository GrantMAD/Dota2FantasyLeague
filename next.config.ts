import type { NextConfig } from "next";

// ---------------------------------------------------------------------------
// Security headers applied to every response.
//
// CSP notes:
//  • script-src uses 'unsafe-inline' to allow the sidebar flash-prevention
//    script in app/layout.tsx (<script dangerouslySetInnerHTML={...} />).
//    Migrate to per-request nonces (Next.js middleware) to remove this.
//  • style-src uses 'unsafe-inline' because Tailwind and Radix UI inject
//    inline styles at runtime.
//  • font-src is 'self' only — next/font/google self-hosts Geist at build
//    time, so no external font origin is needed.
//  • connect-src includes wss://*.supabase.co for Supabase Realtime.
//  • img-src covers Steam game-asset CDNs (hero images, item icons, team
//    logos) AND Steam player avatar CDNs (avatars.steamstatic.com and
//    avatars.akamai.steamstatic.com) which serve profile images returned by
//    ISteamUser/GetPlayerSummaries.  Supabase covers manager profile avatars.
// ---------------------------------------------------------------------------
const ContentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  [
    "img-src 'self' data: blob:",
    "https://steamcdn-a.akamaihd.net",
    "https://steamusercontent-a.akamaihd.net",
    "https://cdn.steamusercontent.com",
    "https://cdn.cloudflare.steamstatic.com",
    // Player profile avatars returned by ISteamUser/GetPlayerSummaries:
    "https://avatars.steamstatic.com",
    "https://avatars.akamai.steamstatic.com",
    "https://*.supabase.co",
  ].join(" "),
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  // Whitelist of exactly which origins may load resources.
  // Primary XSS mitigation at the browser level.
  { key: "Content-Security-Policy", value: ContentSecurityPolicy },

  // Prevent this page from being embedded in an iframe (clickjacking).
  // Redundant with frame-ancestors in the CSP above, but kept for
  // compatibility with browsers that don't yet support CSP frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },

  // Stop browsers from sniffing the MIME type of responses.
  // Prevents disguised file uploads (e.g. a script saved as .jpg) from
  // being executed as JavaScript.
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Send only the scheme+origin (not path or query string) in the
  // Referer header on cross-origin requests, preventing URL leakage
  // to Steam CDN, Supabase, or any future third-party origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Explicitly disable browser features the app never uses.
  // Limits the blast radius of an XSS attack — an injected script
  // cannot activate the user's camera, microphone, or location.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },

  // Tell browsers to always use HTTPS for this domain for the next 2 years,
  // even if the user types http://. Closes the SSL-stripping window on
  // first visits. includeSubDomains covers any subdomains on the same cert.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Apply security headers to every route — pages, API routes, and assets.
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 3600,
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
      // Player profile avatars (ISteamUser/GetPlayerSummaries):
      {
        protocol: 'https',
        hostname: 'avatars.steamstatic.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.akamai.steamstatic.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/profile-avatars/**',
      },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
