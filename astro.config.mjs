// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://think-small-philosophy.probir.workers.dev',

  // "file" keeps the URL contract the whole site is generated against:
  // dist/ideas.html is served at /ideas, with NO trailing slash, via
  // Cloudflare's auto-trailing-slash html handling.
  build: { format: 'file' },

  image: {
    service: { entrypoint: 'astro/assets/services/sharp' },
  },

  devToolbar: { enabled: false },

  adapter: cloudflare({
    // Since Astro 6 the adapter defaults to 'cloudflare-binding', which
    // transforms images at REQUEST time through a Cloudflare Images binding
    // (auto-provisioned, and billed as transforms). Every page here is
    // prerendered, so sharp already emitted the resized webp at build time.
    // 'compile' keeps it build-time-only and drops the unneeded binding.
    imageService: 'compile',
  }),
});
