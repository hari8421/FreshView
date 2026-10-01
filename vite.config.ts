import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Freebuff requires HMR to stay disabled; the managed preview handles serving.
  server: { hmr: false },
  build: { outDir: "dist", assetsInlineLimit: 8192 },
  base: "./",
});
