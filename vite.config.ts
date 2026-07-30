// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// STATIC_BUILD=1 -> build for the offline APK: prerender "/" into a static
// index.html. The custom server entry is skipped in that mode because the
// prerender preview server expects the default entry filename.
const isStaticBuild = process.env.STATIC_BUILD === "1";

export default defineConfig({
  tanstackStart: isStaticBuild
    ? {
        prerender: { enabled: true, crawlLinks: false },
        pages: [{ path: "/", prerender: { enabled: true } }],
      }
    : {
        // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
        // nitro/vite builds from this
        server: { entry: "server" },
      },
});


