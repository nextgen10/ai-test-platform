import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },

  // A build and a running `next dev` otherwise fight over `.next`, which fails
  // in confusing ways (a missing turbopack runtime, a phantom `_document`).
  // Setting NEXT_DIST_DIR lets CI — or a verification build on a machine where
  // someone is developing — write somewhere else entirely.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // MUI ships both ESM and CJS. Left alone, a production build can resolve
  // @mui/material and @mui/system through different halves of that pair, and
  // the prerender then fails with "unstable_createUseMediaQuery is not a
  // function" — a symptom with no obvious connection to its cause. Transpiling
  // them here forces one consistent copy.
  transpilePackages: ["@mui/material", "@mui/system", "@mui/icons-material"],

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
