import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { federationSafeAliases } from '../shared-ui/build/federationAliases';
import { devCustomIntegrations } from './devCustomIntegrations';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootNodeModules = path.resolve(__dirname, '../../node_modules');

const devProxy = (env) => ({
  target: env.VITE_DEV_API_PROXY || 'https://sila-api.chervicaon.com',
  changeOrigin: true,
  secure: false,
  configure: (proxy) => {
    proxy.on('proxyRes', (proxyRes) => {
      const cookies = proxyRes.headers['set-cookie'];
      if (!cookies) return;
      proxyRes.headers['set-cookie'] = cookies.map((cookie) =>
        cookie
          .replace(/;\s*Domain=[^;]*/i, '')
          .replace(/;\s*SameSite=None/i, '; SameSite=Lax'),
      );
    });
  },
});

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      ...(command === 'serve' ? [devCustomIntegrations(env.VITE_DEV_API_PROXY || 'https://sila-api.chervicaon.com', path.resolve(__dirname, '../../.data/custom-integrations.json'))] : []),
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
              // node_modules/@vosox/shared-ui follows the vosox checkout, which is behind this tree.
              '@vosox/shared-ui': path.resolve(__dirname, '../shared-ui/src/index.ts'),
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
      // Dev stays same-origin so the access_token cookie is not dropped as third-party.
      // The API sets Domain=.chervicaon.com; strip that so the cookie belongs to localhost.
      proxy: command === 'serve' ? {
        '/api': devProxy(env),
        '/buyermessageHub': { ...devProxy(env), ws: true },
        '/suppliermessageHub': { ...devProxy(env), ws: true },
      } : undefined,
    },
    build: {
      target: 'esnext',
      minify: false,
      cssCodeSplit: false,
    },
  };
});
