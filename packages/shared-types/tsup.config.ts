import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  splitting: false,
  treeshake: true,
  target: "node20",
  // Bundle zod to avoid runtime dependency issues in Docker
  noExternal: ["zod"],
  keepNames: true,
  shims: false,
});
