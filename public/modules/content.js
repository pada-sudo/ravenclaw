import { fetchJson } from './api.js';

let cache = {};

export async function loadContent() {
  if (cache._ready) return cache;
  const [gates, sop, raci, kpi, bpom] = await Promise.all([
    fetchJson('/content/gates.json'),
    fetchJson('/content/sop.json'),
    fetchJson('/content/raci.json'),
    fetchJson('/content/kpi.json'),
    fetchJson('/content/bpom-case.json'),
  ]);
  cache = { gates, sop, raci, kpi, bpom, _ready: true };
  return cache;
}

export function getContent() {
  return cache;
}
