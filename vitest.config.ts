import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// Unit tests only: e2e/ holds Playwright specs, run with `npm run e2e`.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { exclude: [...configDefaults.exclude, "e2e/**"] },
});
