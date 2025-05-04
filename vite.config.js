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
        // Only listen on localhost in development
        host: 'localhost',
        port: 5173,
        // Expose the server to the host machine instead of container network
        strictPort: true,
        hmr: {
            clientPort: 5173, // Match the port exposed to the host
        },
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            }
        }
    }
});