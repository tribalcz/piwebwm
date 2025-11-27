import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    root: '',
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        sourcemap: true,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
            }
        }
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
            '@css': path.resolve(__dirname, 'src/styles'),
            '@core': path.resolve(__dirname, 'src/core'),
            '@components': path.resolve(__dirname, 'src/components'),
            '@apps': path.resolve(__dirname, 'src/apps'),
            '@utils': path.resolve(__dirname, 'src/utils'),
        }
    },
    css: {
        modules: {
            localsConvention: 'camelCase',
        }
    },
    server: {
        port: 3000,
        host: '0.0.0.0',
        watch: {
            usePolling: true,
        },
        proxy: {
            '/api': {
                target: 'http://backend:8080',
                changeOrigin: true,
            }
        }
    }
});