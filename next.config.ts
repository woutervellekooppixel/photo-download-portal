import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.r2.cloudflarestorage.com",
      },
    ],
  },
  // Increase body size limit for file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
  },
  // API route config
  api: {
    bodyParser: {
      sizeLimit: '100mb',
    },
    responseLimit: false,
  },
};

export default nextConfig;
