// Keep Lovable's built-in plugins. Do not add a second Nitro plugin.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Lovable preview uses its own sandbox target. Vercel builds must use
// Nitro's Vercel preset and Vercel Build Output API directories.
const isLovableSandbox =
  process.env.LOVABLE_SANDBOX === "1" ||
  !!process.env.DEV_SERVER__PROJECT_PATH;

export default defineConfig({
  tanstackStart: {
    // Preserve the existing SSR server entry.
    server: { entry: "server" },
  },
  ...(isLovableSandbox
    ? {}
    : {
        nitro: {
          preset: "vercel",
          output: {
            dir: ".vercel/output",
            serverDir: ".vercel/output/functions/__server.func",
            publicDir: ".vercel/output/static",
          },
        },
      }),
});
