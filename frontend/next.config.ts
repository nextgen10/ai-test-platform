import os from "node:os";
import type { NextConfig } from "next";

/**
 * Next.js 15 only allowlists localhost for `/_next/*` in `next dev`.
 * Opening the printed Network URL (LAN IP) then loads HTML with no JS, so
 * the UI looks like it never launched. Allow every current IPv4 address plus
 * optional extras from ALLOWED_DEV_ORIGINS.
 */
function lanDevOrigins(): string[] {
  const extra = (process.env.ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim().replace(/^https?:\/\//, "").split(":")[0])
    .filter(Boolean);

  const ips: string[] = [];
  try {
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const addr of addrs ?? []) {
        if (addr.family === "IPv4" && !addr.internal) ips.push(addr.address);
      }
    }
  } catch {
    // Restricted environments (CI, sandboxes) cannot list interfaces.
  }

  return [...new Set([...ips, ...extra])];
}

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const sessionBasePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const allowedDevOrigins = lanDevOrigins();

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  ...(sessionBasePath ? { basePath: sessionBasePath } : {}),
  // Omit when empty: an empty array switches Next from "warn" to "block".
  ...(allowedDevOrigins.length ? { allowedDevOrigins } : {}),

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
