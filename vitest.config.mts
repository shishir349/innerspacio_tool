import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // The real `server-only` package always throws outside of Next's own
      // bundler (which normally strips it from genuine server builds).
      // Under Vitest there's no such build step, so route it to a no-op.
      "server-only": path.resolve(import.meta.dirname, "test/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
  },
});
