// @ts-check
import { defineConfig } from 'astro/config';

import preact from '@astrojs/preact';

import tailwindcss from '@tailwindcss/vite';

// Every page here is prerendered at build time, and Cloudflare's own Astro
// framework guide is explicit that a fully pre-rendered Astro project does not
// need the Cloudflare adapter: "Astro will pre-render all pages at build time
// by default, and you can simply upload those static assets to be served by
// Cloudflare."
//
// So there is no adapter and no `main` entrypoint. Deploying dist/ as Workers
// static assets serves all 30 routes with zero bindings. The adapter earns its
// place the day this site gains an on-demand route (the vote tally is the
// obvious candidate) — and not before.
export default defineConfig({
  site: 'https://little-thinker.probir.dev',

  // "file" keeps the URL contract every internal link is generated against:
  // dist/ideas.html is served at /ideas, with NO trailing slash, via
  // Cloudflare's auto-trailing-slash html handling.
  build: { format: 'file' },

  image: {
    // Build-time transforms only (sharp). Nothing at request time.
    service: { entrypoint: 'astro/assets/services/sharp' },
  },

  devToolbar: { enabled: false },
  integrations: [preact()],

  vite: {
    plugins: [tailwindcss()],
  },
});