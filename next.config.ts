import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    serverActions: {
      // CSV imports are capped at 3 MB per file; leave headroom for multipart encoding (default is 1 MB).
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
