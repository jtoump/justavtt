import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      host: true,
      port: parseInt(env.VITE_PORT) || 5173,
      strictPort: true // Fail if port is already in use instead of trying another
    }
  };
});
