import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* This app is a dynamic, database-backed internal tool — nearly every
   * route reads fresh per-request data and is mutated via server actions,
   * so Cache Components/PPR provide no benefit here and only add friction. */
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
