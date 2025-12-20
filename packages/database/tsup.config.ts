import { defineConfig } from "tsup";
import { copyFileSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";

export default defineConfig({
  entry: ["src/index.ts", "src/schema.ts"],
  format: ["esm"],
  dts: false, // Use tsc for type generation instead
  sourcemap: true,
  clean: true,
  outDir: "dist",
  splitting: false,
  treeshake: true,
  target: "node20",
  skipNodeModulesBundle: true,
  keepNames: true,
  shims: false,
  onSuccess: async () => {
    // Copy migrations folder to dist
    const srcMigrations = join(process.cwd(), "src", "migrations");
    const distMigrations = join(process.cwd(), "dist", "migrations");

    try {
      mkdirSync(distMigrations, { recursive: true });

      // Copy all SQL files
      const files = readdirSync(srcMigrations);
      for (const file of files) {
        if (file.endsWith(".sql")) {
          copyFileSync(
            join(srcMigrations, file),
            join(distMigrations, file)
          );
        }
      }

      // Copy meta folder
      const srcMeta = join(srcMigrations, "meta");
      const distMeta = join(distMigrations, "meta");
      mkdirSync(distMeta, { recursive: true });

      const metaFiles = readdirSync(srcMeta);
      for (const file of metaFiles) {
        copyFileSync(
          join(srcMeta, file),
          join(distMeta, file)
        );
      }

      console.log("✓ Migrations copied to dist folder");
    } catch (error) {
      console.error("Failed to copy migrations:", error);
      throw error;
    }
  },
});
