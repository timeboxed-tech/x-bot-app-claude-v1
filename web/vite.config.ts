import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

function gitInfo() {
  try {
    const sha = execSync('git rev-parse --short HEAD').toString().trim();
    const date = execSync('git log -1 --format=%ci').toString().trim().split(' ')[0];
    return { sha, date };
  } catch {
    return { sha: 'unknown', date: 'unknown' };
  }
}

const git = gitInfo();

export default defineConfig({
  plugins: [react()],
  define: {
    __GIT_SHA__: JSON.stringify(git.sha),
    __GIT_DATE__: JSON.stringify(git.date),
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
