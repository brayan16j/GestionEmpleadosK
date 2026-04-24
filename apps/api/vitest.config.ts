import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globals: true,
    pool: "forks",
    forks: {
      singleFork: true,
    },
    fileParallelism: false,
    globalSetup: ["./test/setup/global.ts"],
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});
