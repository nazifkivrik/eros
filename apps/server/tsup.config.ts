import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/**/*.ts"],
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
});
