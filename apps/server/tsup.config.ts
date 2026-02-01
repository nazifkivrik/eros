import { defineConfig } from "tsup";

export default defineConfig({
  // Use negative patterns to exclude test files
  entry: ["src/**/*.ts", "!src/**/*.test.ts", "!src/**/*.spec.ts", "!src/**/vitest.config.ts"],
  format: ["esm"],
  dts: false,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  target: "node20",
  // Keep directory structure
  keepNames: true,
  // Enable experimental features for better ESM support
  shims: false,
  esbuildOptions: (options) => {
    // Preserve tsconfig path aliases - tsup handles this natively with tsconfig
    options.preserveSymlinks = true;
    // Exclude vitest packages from the bundle
    options.external = [
      "vitest",
      "@vitest/*",
      "vite",
      "vite/*",
      "@vitest/runner",
      "@vitest/runner/*",
      "@vitest/utils",
      "@vitest/utils/*",
      "@vitest/spy",
      "pathe",
      "vite/module-runner",
    ];
  },
});
