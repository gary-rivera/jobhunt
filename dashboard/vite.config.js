import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Builds the static SPA straight into the Express app's ./public dir, which the
// server serves at http://<lan-ip>:3000/. Run `npm run build` on derry-server.
export default defineConfig({
    plugins: [react()],
    base: '/',
    build: {
        outDir: '../jobhunt/public',
        emptyOutDir: true,
    },
    server: {
        port: 5173,
    },
});
