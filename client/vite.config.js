import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true, // доступно с других устройств в локальной сети
    port: 5173,
  },
});
