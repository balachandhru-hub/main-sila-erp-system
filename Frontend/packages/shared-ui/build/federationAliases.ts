import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const syncExternalStoreShim = path.resolve(here, '../src/shims/useSyncExternalStore.ts');

/**
 * Aliases every app's vite config applies in dev and build, so CommonJS packages that
 * `require('react')` cannot pull a second React into a federated bundle.
 * Covers: use-sync-external-store, /shim, /with-selector and /shim/with-selector (with or without .js).
 */
export const federationSafeAliases = [
  {
    find: /^use-sync-external-store(\/shim)?(\/index)?(\/with-selector)?(\.js)?$/,
    replacement: syncExternalStoreShim,
  },
];
