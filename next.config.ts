import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Logos come from third-party APIs on arbitrary hosts. Serving them unoptimized
    // lets the browser load them directly instead of turning /_next/image into an
    // open image proxy that fetches from any site on our server's bandwidth.
    unoptimized: true,
  },
};

export default nextConfig;
