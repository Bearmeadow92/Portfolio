/// <reference types="vitest/config" />
/**
 * Build and test configuration.
 * - React plugin for JSX and Fast Refresh.
 * - Tailwind CSS v4 runs as a Vite plugin (no PostCSS config needed).
 * - Vitest runs the pure logic tests in a plain Node environment.
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
