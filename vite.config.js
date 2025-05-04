import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    root: path.resolve(__dirname, 'client'),
    build: {
        outDir: path.resolve(__dirname, 'public/dist'),
        emptyOutDir: true,
        manifest: true,
    },
    server: {
        // Listen on all interfaces to be accessible within the container
        host: '0.0.0.0',
        port: 5173,
        // Expose the server to the host machine instead of container network
        strictPort: true,
        hmr: {
            clientPort: 5173, // Match the port exposed to the host
            // Allow HMR to work in all environments
            host: '0.0.0.0',
        },
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            }
        }
    }
});