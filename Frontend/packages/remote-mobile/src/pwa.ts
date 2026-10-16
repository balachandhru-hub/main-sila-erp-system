import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const standalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const ios = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Registers the SILA Store service worker for this origin. */
export const registerMobilePwa = (): void => {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/mobile/sw.js', { scope: '/mobile/' }).catch(() => {
    // The browser install menu remains available when registration is blocked.
  });
};

/** Install prompt for SILA Store, plus the installed and iOS states. */
export const useInstallApp = (): {
  installed: boolean;
  canInstall: boolean;
  iosHint: boolean;
  install: () => Promise<void>;
} => {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(standalone);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setPrompt(null);
  };

  return {
    installed,
    canInstall: prompt !== null && !installed,
    iosHint: !installed && prompt === null && ios(),
    install,
  };
};
