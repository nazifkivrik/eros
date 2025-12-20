import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/**/*.ts"],
  format: ["esm"],
  dts: false, // Disable type definitions for production build
  sourcemap: true,
  clean: true,
  outDir: "dist",
  splitting: false,
  treeshake: true,
  minify: false,
  target: "node20",
  skipNodeModulesBundle: true,
  // Keep directory structure
  keepNames: true,
  // Enable experimental features for better ESM support
  shims: false,
});
