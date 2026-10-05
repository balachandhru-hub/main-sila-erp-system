import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/** Nav key → the URL segment that shows it, e.g. `{ userList: 'users' }` → /users. */
export type RouteNavPaths = Readonly<Record<string, string>>;

/**
 * Drop-in replacement for a dashboard's `useState` holding its active nav key, so every
 * section has a clean, role-neutral URL (/dashboard, /rfqs, /users …) that survives a
 * refresh and works with Back/Forward.
 *
 * - The active key is read from the first path segment.
 * - The setter navigates to that key's segment.
 * - Several keys may share a segment (e.g. `allRfqs` and `activeRFQs` → /rfqs); the first
 *   listed is used when the page is loaded from the URL.
 * - Keys with no segment (transient views such as an open RFQ) are kept without changing the URL.
 * - An unknown segment (old bookmark, typo) redirects to the fallback section.
 *
 * Pass `paths` as a module-level constant so its identity is stable.
 */
export function useRouteNav(paths: RouteNavPaths, fallbackKey: string): [string, (key: string) => void] {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [override, setOverride] = useState<{ key: string; pathname: string } | null>(null);

  // Handlers registered in effects (e.g. popstate) call the setter later; read the live path.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const segment = pathname.split('/').filter(Boolean)[0] ?? '';
  const routedKey = Object.keys(paths).find((key) => paths[key] === segment);
  const activeNav = override && override.pathname === pathname ? override.key : routedKey ?? fallbackKey;

  useEffect(() => {
    if (routedKey === undefined) navigate(`/${paths[fallbackKey]}`, { replace: true });
  }, [routedKey, paths, fallbackKey, navigate]);

  const setActiveNav = useCallback(
    (key: string) => {
      const current = pathnameRef.current;
      const segmentForKey = paths[key];

      if (segmentForKey === undefined) {
        setOverride({ key, pathname: current });
        return;
      }

      const target = `/${segmentForKey}`;
      const primaryKey = Object.keys(paths).find((candidate) => paths[candidate] === segmentForKey);
      setOverride(primaryKey === key ? null : { key, pathname: target });
      if (target !== current) navigate(target);
    },
    [paths, navigate],
  );

  return [activeNav, setActiveNav];
}
