import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "bighorncustomworks.com" },
    ],
  },
  experimental: {
    middlewareClientMaxBodySize: "50mb",
    serverActions: { bodySizeLimit: "50mb" },
  },
};

export default nextConfig;
