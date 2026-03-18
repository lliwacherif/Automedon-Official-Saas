import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
    plugins: [
        vue(),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './resources/js'),
        },
    },
    server: {
        proxy: {
            '/api/scaleway': {
                target: 'https://api.scaleway.ai/1b0ca8d6-b434-4200-9818-4f56c17232ff/v1',
                changeOrigin: true,
                rewrite: (p) => p.replace(/^\/api\/scaleway/, ''),
                secure: true,
            },
        },
    },
});
