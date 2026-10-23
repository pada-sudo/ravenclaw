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
  const hash = buildHash(path, params);
  // Update the address bar in place. Assigning location.hash fires hashchange,
  // which re-renders the whole view and throws the user back to the top; tab and
  // gate switches already update their own DOM, so no re-render is wanted.
  if (location.hash === hash) return;
  history.replaceState(null, '', hash);
}
