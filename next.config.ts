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
        hostname: "**",
      },
    ],
    minimumCacheTTL: 60,
    formats: ['image/webp'],
    unoptimized: process.env.NODE_ENV === 'development',
  },

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
      // Allow mixed content for IPTV streams (HTTP on HTTPS site)
      {
        source: '/iptv/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; media-src * data: blob:;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
