import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset URLs so the build works from any path (e.g. GitHub Pages)
  base: './',
  server: { host: true, port: 8000 },
  // reveal.js plus plugins is a single ~1.1MB chunk; that is expected here
  build: { chunkSizeWarningLimit: 1500 },
})
