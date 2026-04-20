import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  optimizeDeps: {
    esbuildOptions: { target: "es2022" },
  },
  build: {
    target: "es2022",
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
