export function parseRoute() {
  const raw = location.hash.replace(/^#/, '') || '/dashboard';
  const [path, search] = raw.split('?');
  const params = new URLSearchParams(search || '');
  return { path, params };
}

export function buildHash(path, params) {
  const q = new URLSearchParams(params || {});
  const qs = q.toString();
  return `#${path}${qs ? '?' + qs : ''}`;
}

export function navigate(path, params) {
  location.hash = buildHash(path, params);
}

export function getRoute() {
  const { path, params } = parseRoute();
  const parts = path.split('/').filter(Boolean);
  return { path, parts, params };
}

export function onRouteChange(cb) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function setParams(params) {
  const { path } = parseRoute();
  navigate(path, params);
}
