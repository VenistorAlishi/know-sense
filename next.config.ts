import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Large Telegram ChatExport zips (media) via /api/ingest
    serverActions: {
      bodySizeLimit: "512mb",
    },
  },
};

export default nextConfig;
