import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { heroPhotoSizes, interiorPhotos, sceneImageProps } from './src/interiorPhotos.js';

// Hash routes share one HTML document. Only the home route needs the first interior
// photo before React mounts. Use the same candidates as the rendered image.
function preloadHomePhoto() {
  return {
    name: 'preload-home-photo',
    transformIndexHtml(html) {
      const photo = sceneImageProps(interiorPhotos[0].stem, heroPhotoSizes, './');
      return html.replace('<!-- preload-home-photo -->', `<script>
        if (['', '#', '#/', '#/#about'].includes(location.hash)) {
          const photo = document.createElement('link');
          photo.rel = 'preload';
          photo.as = 'image';
          photo.imageSrcset = ${JSON.stringify(photo.srcSet)};
          photo.imageSizes = ${JSON.stringify(photo.sizes)};
          photo.fetchPriority = 'high';
          document.head.append(photo);
        }
      </script>`);
    },
  };
}

export default defineConfig({
  plugins: [react(), preloadHomePhoto()],
  base: './',
  server: {
    port: 5180,
    strictPort: true,
    watch: { ignored: ['**/.qa/**'] },
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true } },
  },
  preview: { port: 4173, strictPort: true },
});
