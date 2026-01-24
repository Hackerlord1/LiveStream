/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "flagcdn.com",
      },
      {
        protocol: "https",
        hostname: "i.ibb.co",
      },
      {
        protocol: "https",
        hostname: "api.cdn-live.tv",
      },
      {
        protocol: "https",
        hostname: "**", // Wildcard for all HTTPS domains (use cautiously)
      },
    ],
    minimumCacheTTL: 60,
    formats: ['image/webp'],
    unoptimized: process.env.NODE_ENV === 'development',
  },

  // ✅ FIXED: Correct option name for Next.js 16+
  serverExternalPackages: ['sharp'],

  async headers() {
    return [
      {
        source: '/_next/image',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=31536000',
          },
        ],
      },
    ];
  },
};

export default nextConfig;