import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // iPhone photos run 3-6MB; receipts shot at high res can be bigger.
  // Default server action body limit (1MB) silently rejects them.
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
