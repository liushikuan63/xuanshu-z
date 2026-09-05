/** 极简 hash 路由（三壳一致，离线可用） */
import { useEffect, useState, useCallback } from 'react';

export interface Route { path: string; parts: string[]; query: URLSearchParams; hash: string }

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/home';
  const [pathAndQuery] = raw.split('#');
  const [path, qs = ''] = pathAndQuery.split('?');
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs), hash: raw };
}

export function useRouter(): [Route, (to: string) => void] {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const onHash = () => { setRoute(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const nav = useCallback((to: string) => {
    window.location.hash = to.startsWith('#') ? to.slice(1) : to;
  }, []);
  return [route, nav];
}

export function useQuery(): URLSearchParams {
  return parse().query;
}
