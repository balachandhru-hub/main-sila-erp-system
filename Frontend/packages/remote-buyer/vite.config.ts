import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { federationSafeAliases } from '../shared-ui/build/federationAliases';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootNodeModules = path.resolve(__dirname, '../../node_modules');

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    federation({
      name: 'remoteBuyer',
      filename: 'remoteEntry.js',
      exposes: {
        './BuyerApp': './src/BuyerApp.tsx',
      },
      shared: [
        'react',
        'react-dom',
        'react-router-dom',
      ],
    }),
  ],
  resolve: {
    dedupe: ['react', 'react-dom', 'react-router-dom'],
    alias: [
      ...federationSafeAliases,
      ...(command === 'serve'
        ? Object.entries({
            react: path.resolve(rootNodeModules, 'react'),
            'react-dom': path.resolve(rootNodeModules, 'react-dom'),
            'react-router-dom': path.resolve(rootNodeModules, 'react-router-dom'),
          }).map(([find, replacement]) => ({ find, replacement }))
        : []),
    ],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
  server: {
    port: 6002,
    strictPort: true,
    https: {
      key: fs.existsSync('../host-app/localhost-key.pem') ? fs.readFileSync('../host-app/localhost-key.pem') : undefined,
      cert: fs.existsSync('../host-app/localhost.pem') ? fs.readFileSync('../host-app/localhost.pem') : undefined,
    },
  },
  preview: {
    port: 6002,
    strictPort: true,
    https: {
      key: fs.existsSync('../host-app/localhost-key.pem') ? fs.readFileSync('../host-app/localhost-key.pem') : undefined,
      cert: fs.existsSync('../host-app/localhost.pem') ? fs.readFileSync('../host-app/localhost.pem') : undefined,
    },
  },
  build: {
    target: 'esnext',
    cssCodeSplit: false,
  },
}));
