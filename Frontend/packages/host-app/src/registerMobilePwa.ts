/** Registers the SILA Store service worker. Safe to call more than once. */
export const registerMobilePwa = (): void => {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/mobile/sw.js', { scope: '/mobile/' }).catch(() => {
    // Install still works from the browser menu when registration is blocked.
  });
};
