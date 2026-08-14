import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },

  // Self-contained server bundle for the container image. Gated so local
  // `npm run dev` / `npm start` keep their normal behaviour.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,

  // NOTE: the orchestrator proxy is a route handler (src/app/api/v1/[...path]),
  // not a rewrite. `rewrites()` destinations are baked into routes-manifest.json
  // at build time, so $API_TARGET could not be set per-environment at deploy time.

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
