import type { NextConfig } from "next";

// Server-only — never NEXT_PUBLIC_, since it's read here at request time by
// Next's own routing layer, not shipped to the browser bundle.
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  // @aik/shared is a workspace package (pre-compiled to plain JS via its
  // own build step) — kept in transpilePackages so Next processes it
  // through its own pipeline rather than treating it as opaque node_modules.
  transpilePackages: ["@aik/shared"],

  // Proxies /api/* to the Express API so the browser only ever talks to this
  // app's own origin. The frontend (Vercel) and backend (Render) are
  // different sites, which makes the session cookie a third-party cookie
  // from the browser's perspective — browsers like Brave and Safari block
  // those by default regardless of correct SameSite=None; Secure. Routing
  // through this same-origin proxy makes Set-Cookie arrive as first-party
  // instead, which sidesteps that blocking entirely rather than fighting it.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_ORIGIN}/:path*` }];
  },
};

export default nextConfig;
