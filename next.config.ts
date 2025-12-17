import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Suppress HMR warnings (these are harmless WebSocket connection messages)
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 5,
  },
  // Logging configuration
  logging: {
    fetches: {
      fullUrl: false,
    },
  },
};

export default nextConfig;
