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
    // Increase timeout to 30 seconds (default is 10)
    minimumCacheTTL: 60,
    formats: ['image/webp'],
    // Disable optimization in development for faster builds
    unoptimized: process.env.NODE_ENV === 'development',
  },
  // Increase overall timeout
  experimental: {
    serverComponentsExternalPackages: ['sharp'],
  },
  // Add these headers for better performance
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