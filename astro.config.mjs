// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Canonical origin. Build format stays "file" so pages land on
  // /philosophers/socrates.html and Cloudflare serves them extensionless
  // (html_handling: auto-trailing-slash) — the same contract the static
  // prototype shipped with.
  site: 'https://think-small.probir.workers.dev',
  build: { format: 'file' },
  image: {
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
  devToolbar: { enabled: false },
});
