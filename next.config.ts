import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No server-side ffmpeg anymore — merge is done in the browser via ffmpeg.wasm.
  // proxyClientMaxBodySize is no longer needed for the merge route.
};

export default nextConfig;
