import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Admin accounts see the admin pages under /admin. proxy.ts decides who may go where; this serves the
  // /superadmin page for /admin as a plain path rewrite (no host involved, so it works behind nginx too).
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/admin", destination: "/superadmin" },
        { source: "/admin/:path*", destination: "/superadmin/:path*" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
