import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Logos come from third-party APIs on arbitrary hosts. Serving them unoptimized
    // lets the browser load them directly instead of turning /_next/image into an
    // open image proxy that fetches from any site on our server's bandwidth.
    unoptimized: true,
  },
  // The channels page is now the IPTV one. Old channel ids don't exist there, so links
  // to a single channel land on the list.
  async redirects() {
    return [
      { source: "/channels", destination: "/iptv/channels", permanent: false },
      { source: "/channels/:id", destination: "/iptv/channels", permanent: false },
    ];
  },
};

export default nextConfig;
