import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// App React (client/) — em dev roda na :5173 e faz proxy de /api pro Express.
// `npm run build` gera client/dist, que o Express serve em produção.
export default defineConfig({
  root: "client",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
      // fotos de imóvel servidas pelo Express
      "/uploads": "http://localhost:3000",
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
