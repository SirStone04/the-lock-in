import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const requestedBase = env.VITE_BASE_PATH || env.BASE_PATH || "/";
  const base = `/${requestedBase.split("/").filter(Boolean).join("/")}${requestedBase === "/" ? "" : "/"}`;
  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "prompt",
        injectRegister: null,
        includeAssets: [
          "icon.svg",
          "favicon.ico",
          "apple-touch-icon.png",
          "pwa-192.png",
          "pwa-512.png",
        ],
        manifest: {
          id: base,
          name: "THE LOCK-IN",
          short_name: "LOCK-IN",
          description:
            "Discipline. Consistency. Progress. Your private personal operating system.",
          start_url: base,
          scope: base,
          display: "standalone",
          orientation: "any",
          theme_color: "#10151e",
          background_color: "#0b1018",
          icons: [
            {
              src: "pwa-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "pwa-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "pwa-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,png,svg,woff,woff2}"],
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
          // Only the app shell is precached. Firestore owns private offline records.
          runtimeCaching: [],
        },
        devOptions: { enabled: false },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes("node_modules/firebase") ||
              id.includes("node_modules/@firebase")
            )
              return "firebase";
            if (
              id.includes("node_modules/recharts") ||
              id.includes("node_modules/d3-")
            )
              return "charts";
          },
        },
      },
    },
  };
});
