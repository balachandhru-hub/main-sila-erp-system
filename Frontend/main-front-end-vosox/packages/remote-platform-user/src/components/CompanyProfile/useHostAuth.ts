import { useEffect, useState } from 'react';

export interface HostAuth {
  buyerId: string | null;
  supplierId: string | null;
}

export function useHostAuth(): HostAuth | null {
  const [auth, setAuth] = useState<HostAuth | null>(
    () => (window as any).__hostAuth__ ?? null
  );

  useEffect(() => {
    const handler = (e: Event) => {
      setAuth((e as CustomEvent<HostAuth>).detail ?? null);
    };
    window.addEventListener('host-auth-changed', handler);
    if ((window as any).__hostAuth__) {
      setAuth((window as any).__hostAuth__);
    }

    return () => window.removeEventListener('host-auth-changed', handler);
  }, []);

  return auth;
}