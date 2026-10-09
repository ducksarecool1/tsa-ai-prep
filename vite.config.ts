/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` makes the build work from any sub-path (GitHub Pages, a USB stick, a school server).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    // The study content (8 units, glossary, challenges) is bundled so the app works offline.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      onwarn(warning, warn) {
        // Harmless notices about comment placement inside third-party packages.
        if (warning.code === 'INVALID_ANNOTATION' && warning.id?.includes('node_modules')) return;
        warn(warning);
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
