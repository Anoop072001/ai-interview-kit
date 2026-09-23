import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @aik/shared ships TS source (no build step) — Next doesn't transpile
  // TS from workspace packages under node_modules unless told to.
  transpilePackages: ["@aik/shared"],
};

export default nextConfig;
