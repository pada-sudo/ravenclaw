import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  $, $$, esc, fmt, daysLeft, weekNumber, filled, safeUrl, isSafeUrl,
  percent
} from '../public/modules/utils.js';
import { getRoute, onRouteChange, setParams } from '../public/modules/router.js';
import { stepper, kpiBar, tableScroll } from '../public/modules/components.js';

describe('utils', () => {
  it('esc escapes HTML', () => {
    assert.equal(esc('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  });

  it('esc handles null/undefined', () => {
    assert.equal(esc(null), '');
    assert.equal(esc(undefined), '');
  });

  it('fmt formats dates and ISO strings', () => {
    assert.equal(fmt('2026-10-21'), '21 Okt 2026');
    assert.equal(fmt('2026-10-21T04:32:00.000Z'), '21 Okt 2026');
    assert.equal(fmt(''), '—');
  });

  it('daysLeft calculates remaining days', () => {
    const today = new Date();
    const soon = new Date(today);
    soon.setDate(today.getDate() + 5);
    assert.equal(daysLeft(soon.toISOString().slice(0, 10)), 5);
    const past = new Date(today);
    past.setDate(today.getDate() - 3);
    assert.equal(daysLeft(past.toISOString().slice(0, 10)), -3);
    assert.equal(daysLeft(''), null);
  });

  it('weekNumber returns positive week number', () => {
    assert.ok(Number.isInteger(weekNumber()));
    assert.ok(weekNumber() >= 1 && weekNumber() <= 53);
  });

  it('filled checks strings and arrays', () => {
    assert.equal(filled('text'), true);
    assert.equal(filled(''), false);
    assert.equal(filled(['x']), true);
    assert.equal(filled([]), false);
    assert.equal(filled(null), false);
  });

  it('safeUrl allowlists only http/https/link-evidence', () => {
    assert.equal(safeUrl('https://example.com/a'), 'https://example.com/a');
    assert.equal(safeUrl('http://example.com'), 'http://example.com/');
    assert.equal(safeUrl('link-evidence://bpom/w42'), 'link-evidence://bpom/w42');
    assert.equal(safeUrl('javascript:alert(1)'), '');
    assert.equal(safeUrl('data:text/html,<script>alert(1)</script>'), '');
    assert.equal(safeUrl(''), '');
  });

  it('isSafeUrl matches safeUrl results', () => {
    assert.equal(isSafeUrl('https://example.com'), true);
    assert.equal(isSafeUrl('javascript:alert(1)'), false);
  });

  it('percent clamps between 0 and 100', () => {
    assert.equal(percent(0, 10), 0);
    assert.equal(percent(5, 10), 50);
    assert.equal(percent(15, 10), 100);
    assert.equal(percent(0, 0), 0);
  });
});

describe('router', () => {
  it('parses dashboard hash', () => {
    globalThis.location = { hash: '#/dashboard', href: 'http://localhost/#/dashboard' };
    const r = getRoute();
    assert.equal(r.path, '/dashboard');
    assert.deepEqual(r.parts, ['dashboard']);
  });

  it('parses project detail with params', () => {
    globalThis.location = { hash: '#/project/42?tab=report&gate=G1', href: 'http://localhost/#/project/42?tab=report&gate=G1' };
    const r = getRoute();
    assert.equal(r.path, '/project/42');
    assert.deepEqual(r.parts, ['project', '42']);
    assert.equal(r.params.get('tab'), 'report');
    assert.equal(r.params.get('gate'), 'G1');
  });

  it('ignores empty hash', () => {
    globalThis.location = { hash: '', href: 'http://localhost/' };
    const r = getRoute();
    assert.equal(r.path, '/dashboard');
  });

  it('setParams updates the hash without firing a re-render', () => {
    const replaced = [];
    globalThis.location = { hash: '#/project/42?gate=G1', href: 'http://localhost/#/project/42?gate=G1' };
    globalThis.history = { replaceState: (_state, _title, url) => replaced.push(url) };
    setParams({ gate: 'G2A', tab: 'raid' });
    assert.deepEqual(replaced, ['#/project/42?gate=G2A&tab=raid']);
  });

  it('setParams is a no-op when the hash is unchanged', () => {
    const replaced = [];
    globalThis.location = { hash: '#/project/42?gate=G1&tab=raid', href: 'http://localhost/#/project/42?gate=G1&tab=raid' };
    globalThis.history = { replaceState: (_state, _title, url) => replaced.push(url) };
    setParams({ gate: 'G1', tab: 'raid' });
    assert.deepEqual(replaced, []);
  });
});

describe('components', () => {
  it('kpiBar omits the bar for count metrics', () => {
    assert.equal(kpiBar(null), '');
    assert.equal(kpiBar(undefined), '');
  });

  it('kpiBar exposes a labelled progressbar', () => {
    const html = kpiBar(80, 'Kesiapan administratif');
    assert.match(html, /role="progressbar"/);
    assert.match(html, /aria-label="Kesiapan administratif"/);
    assert.match(html, /aria-valuenow="80"/);
    assert.match(html, /aria-valuemin="0"/);
    assert.match(html, /aria-valuemax="100"/);
  });

  it('stepper renders a tablist with roving tabindex on the selected gate', () => {
    const html = stepper({ gates: ['G0', 'G1'], current: 'G0', selected: 'G1' });
    assert.match(html, /role="tablist"/);
    assert.match(html, /id="gate-tab-G0"[^>]*aria-selected="false"[^>]*tabindex="-1"/);
    assert.match(html, /id="gate-tab-G1"[^>]*aria-selected="true"[^>]*tabindex="0"/);
    assert.match(html, /aria-controls="gateDetail"/);
  });

  it('tableScroll names its scroll region', () => {
    assert.match(tableScroll('<table></table>', 'Tabel RACI'), /aria-label="Tabel RACI"/);
    assert.match(tableScroll('<table></table>'), /aria-label="Tabel data"/);
  });
});

describe('content loader', () => {
  it('loadContent fetches /content files via stub', async () => {
    const { loadContent, getContent } = await import('../public/modules/content.js');
    let calls = 0;
    globalThis.fetch = async (url) => {
      calls++;
      const payload = {
        '/content/gates.json': { gates: { first_responder: ['G0'] }, labels: {}, descriptions: {} },
        '/content/sop.json': { sop_01: { title: 'SOP 01' } },
        '/content/raci.json': { title: 'RACI' },
        '/content/kpi.json': { title: 'KPI' },
        '/content/bpom-case.json': { title: 'BPOM' }
      };
      return { ok: true, json: async () => payload[url] };
    };
    await loadContent();
    const c = getContent();
    assert.equal(c.gates.gates.first_responder.length, 1);
    assert.equal(c.sop.sop_01.title, 'SOP 01');
    assert.ok(calls >= 1);
  });
});
