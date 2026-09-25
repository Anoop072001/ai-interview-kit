import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @aik/shared is a workspace package (pre-compiled to plain JS via its
  // own build step) — kept in transpilePackages so Next processes it
  // through its own pipeline rather than treating it as opaque node_modules.
  transpilePackages: ["@aik/shared"],
};

export default nextConfig;
