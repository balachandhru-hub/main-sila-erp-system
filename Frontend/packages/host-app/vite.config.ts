import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { federationSafeAliases } from '../shared-ui/build/federationAliases';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootNodeModules = path.resolve(__dirname, '../../node_modules');

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      federation({
        remotes: command === 'serve' ? {} : {
          remoteBuyer: env.VITE_REMOTE_BUYER_URL || 'https://localhost:6002/assets/remoteEntry.js',
          remoteSupplier: env.VITE_REMOTE_SUPPLIER_URL || 'https://localhost:6003/assets/remoteEntry.js',
          remotePlatformUser: env.VITE_REMOTE_PLATFORM_USER_URL || 'https://localhost:6004/assets/remoteEntry.js',
          remoteMobile: env.VITE_REMOTE_MOBILE_URL || 'https://localhost:6005/assets/remoteEntry.js',
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
              'remoteBuyer/BuyerApp': path.resolve(__dirname, '../remote-buyer/src/BuyerApp.tsx'),
              'remoteSupplier/SupplierApp': path.resolve(__dirname, '../remote-supplier/src/SupplierApp.tsx'),
              'remoteSupplier/ExternalSupplierBid': path.resolve(__dirname, '../remote-supplier/src/pages/ExternalSupplierBid.tsx'),
              'remotePlatformUser/PlatformUserApp': path.resolve(__dirname, '../remote-platform-user/src/PlatformUserApp.tsx'),
              'remoteMobile/MobileApp': path.resolve(__dirname, '../remote-mobile/src/MobileApp.tsx'),
            }).map(([find, replacement]) => ({ find, replacement }))
          : []),
      ],
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
    },
    server: {
      port: 6001,
      strictPort: true,
      https: {
        key: fs.existsSync('./localhost-key.pem') ? fs.readFileSync('./localhost-key.pem') : undefined,
        cert: fs.existsSync('./localhost.pem') ? fs.readFileSync('./localhost.pem') : undefined,
      },
      // Local gateway: set VITE_DEV_API_PROXY (and leave VITE_AUTH_API_BASE empty) in .env.local so the browser stays same-origin.
      proxy: env.VITE_DEV_API_PROXY
        ? { '/api': { target: env.VITE_DEV_API_PROXY, changeOrigin: true } }
        : undefined,
    },
    build: {
      target: 'esnext',
      minify: false,
      cssCodeSplit: false,
    },
  };
});
