// Minimal hash router: works on any static host (GitHub Pages included) with no server config.
import { useEffect, useState } from 'react';

export interface Route {
  /** Path segments, e.g. ["units", "u3"] for #/units/u3. */
  segments: string[];
  params: URLSearchParams;
}

function parseHash(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = hash.split('?');
  return { segments: path.split('/').filter(Boolean), params: new URLSearchParams(query) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(to: string): void {
  window.location.hash = to.startsWith('#') ? to : `#${to}`;
}
