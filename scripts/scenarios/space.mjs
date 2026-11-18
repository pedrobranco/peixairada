// Space (⌥⌘S, 2026-11-18): every live chat an orbit of its agents, a mark each by state, the legend counting them across
// the board; a chat picked shows its agents as lanes on one clock, a lane opening its agent's tab; the span 15 m · 30 m ·
// 1 h is kept; arrows move the pick, ⌥⌘S again closes it. Shots dark and light, and at a phone's width.
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { agentFiles, agentNoteLine, makeFixture } from '../fixture.mjs';
import { tmpDir } from '../../lib/testserver.mjs';

export const meta = { server: true, fixture: 'auto', prefs: { cards: 'compact', lanesShut: [] } };
const MIN = 60_000;

export default async function (ctx) {
  const out = {}, now = Date.now(), root = realpathSync(tmpDir('peix-sp-')), sleeps = [0, 1, 2, 3, 4].map(() => spawn('sleep', ['300'], { stdio: 'ignore' }));
  const live = (i, more = {}) => ({ pid: sleeps[i].pid, startedAt: now - 90 * MIN, ...more });
  const dir = name => { const d = join(root, name); mkdirSync(d, { recursive: true }); return d; };
  const projects = { 'billing-api': { color: '#3d9a6a' }, infra: { color: '#8b6cf0' }, storefront: { color: '#4a86e8' }, 'mobile-app': { color: '#e0883a' } };
  await ctx.server.api('api/config', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projects }) });
  try {
    const { chats } = makeFixture(ctx.fixture.dir, [
      { cwd: dir('infra'), title: 'Review the staging VPC plan', prompt: 'review the plan', reply: 'Sending three reviewers out.', at: new Date(now - 12 * MIN), live: live(0) },
      { cwd: dir('billing-api'), title: 'Queue for invoice webhooks', prompt: 'move the webhooks to a queue', reply: 'Which queue should they go on?', at: new Date(now - 25 * MIN), live: live(1, { status: 'waiting', waitingFor: 'permission prompt' }) },
      { cwd: dir('storefront'), title: 'Retry declined card payments with backoff', prompt: 'retry them', reply: 'On it.', at: new Date(now - 20 * MIN), live: live(2) },
      { cwd: join(root, 'mobile-app'), title: 'Bump the build number', prompt: 'bump it', reply: 'Bumped on both apps.', at: new Date(now - 30 * MIN), live: live(3) },
      { cwd: join(root, 'storefront'), title: 'Product grid follows the dark theme', prompt: 'fix the grid', reply: 'Done, 14 tests pass.', at: new Date(now - 40 * MIN), live: live(4) },
    ]);
    const [infra, billing, store, mobile] = chats;
    agentFiles({ dir: ctx.fixture.dir, lead: infra, agents: [
      { id: 'cost', asked: 'Price the NAT gateways and endpoints', kind: 'cost', ago: 11 * MIN, steps: ['Read plan/staging.json'] },
      { id: 'sec', asked: 'Look for open ingress and wide IAM', kind: 'security', ago: 11 * MIN, steps: ['Grep 0.0.0.0/0 in modules/'] },
      { id: 'blast', asked: 'What breaks if this applies mid-day', ago: 10 * MIN, steps: ['terraform show -json plan.out'], quiet: 4 * MIN },
    ] });
    agentFiles({ dir: ctx.fixture.dir, lead: billing, agents: [
      { id: 'find', asked: 'Find every webhook handler', kind: 'Explore', ago: 24 * MIN, steps: ['List src/webhooks/'], report: 'Seven handlers under src/webhooks/.', finished: true, tool: 'toolu_find', quiet: 19 * MIN },
      { id: 'retry', asked: 'Check how retries are counted today', ago: 23 * MIN, steps: ['Read src/retry.ts'], report: 'In a column, not a header.', finished: true, tool: 'toolu_retry', quiet: 16 * MIN },
      { id: 'load', asked: 'Load-test the queue prototype', ago: 21 * MIN, steps: ['k6 run scripts/queue.js'], finished: true, tool: 'toolu_load', quiet: 12 * MIN },
    ] });
    appendFileSync(billing.file, JSON.stringify(agentNoteLine({ id: billing.id, cwd: billing.cwd, tool: 'toolu_load', asked: 'Load-test the queue prototype', status: 'failed', said: 'failed: Agent terminated early due to an API error', at: new Date(now - 12 * MIN).toISOString() })) + '\n');
    agentFiles({ dir: ctx.fixture.dir, lead: store, agents: [
      { id: 'api', asked: 'Backoff in the payments client', ago: 18 * MIN, steps: ['Edit src/payments/retry.ts'] },
      { id: 'tests', asked: 'Cover the decline codes', ago: 17 * MIN, steps: ['npm test -- decline'], finished: true, tool: 'toolu_tests', quiet: 2 * MIN },
      { id: 'docs', asked: 'Rewrite the retry docs', ago: 16 * MIN, steps: ['Read docs/payments.md'], finished: true, stopped: true, quiet: 9 * MIN },
    ] });
    appendFileSync(store.file, JSON.stringify(agentNoteLine({ id: store.id, cwd: store.cwd, tool: 'toolu_tests', asked: 'Cover the decline codes', said: 'is waiting on its own background work', at: new Date(now - 2 * MIN).toISOString() })) + '\n');
    agentFiles({ dir: ctx.fixture.dir, lead: mobile, agents: [
      { id: 'bump', asked: 'Bump the build number on both apps', ago: 28 * MIN, steps: ['Edit ios/Info.plist'], report: 'Edited two files.', finished: true, quiet: 25 * MIN },
    ] });

    await ctx.waitFor(`(peix.session('${infra.id}')?.agentRows || []).length === 3 && (peix.session('${store.id}')?.agentRows || []).length === 3 && (peix.session('${billing.id}')?.agentRows || []).some(r => r.st === 'fail') && (peix.session('${mobile.id}')?.agentRows || []).length === 1`, { what: 'every chat’s agents', timeout: 20000 });
    await ctx.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
    await ctx.key('KeyS');
    await ctx.waitFor(`document.querySelector('#sp').open`, { what: 'Space open' });
    await ctx.settle();
    out.orbits = await ctx.evaluate(`[...document.querySelectorAll('#spgrid .sps')].map(b => ({ title: b.querySelector('.spn').textContent, core: b.querySelector('.spc').dataset.st, marks: [...b.querySelectorAll('.spsat .spg')].map(g => g.dataset.st).join(' '), on: b.classList.contains('on') }))`);
    ctx.assert.equal(out.orbits.length, 5, 'every live chat, one orbit each');
    ctx.assert.deepEqual(out.orbits.at(-1), { title: 'Product grid follows the dark theme', core: 'ready', marks: '', on: false }, 'a chat with no agents last, an orbit with none on it');
    const by = t => out.orbits.find(o => o.title === t);
    ctx.assert.equal(by('Queue for invoice webhooks').core, 'ask', 'asking: its ring red');
    ctx.assert.equal(by('Review the staging VPC plan').core, 'work', 'its agents at work: clauding');
    ctx.assert.equal(by('Review the staging VPC plan').marks.split(' ').sort().join(' '), 'quiet run run', 'three at work, one gone quiet');
    ctx.assert.equal(by('Queue for invoice webhooks').marks.split(' ').sort().join(' '), 'done done fail', 'two done, one failed');
    ctx.assert.equal(by('Retry declined card payments with backoff').marks.split(' ').sort().join(' '), 'run stop wait', 'at work, waiting, stopped');
    out.legend = await ctx.evaluate(`Object.fromEntries([...document.querySelectorAll('#spleg li')].map(l => [l.querySelector('.spg').dataset.st, +l.querySelector('b').textContent]))`);
    ctx.assert.deepEqual(out.legend, { run: 3, quiet: 1, wait: 1, fail: 1, done: 3, stop: 1, joined: 0 }, 'the legend counts the board');
    await ctx.shot('space-dark');

    // a chat picked: its lanes on the clock
    await ctx.evaluate(`[...document.querySelectorAll('#spgrid .sps')].find(b => /invoice webhooks/.test(b.textContent)).click()`);
    await ctx.waitFor(`/invoice webhooks/.test(document.querySelector('#spside h2').textContent)`, { what: 'its lanes' });
    out.lanes = await ctx.evaluate(`[...document.querySelectorAll('#spside .splane')].map(l => ({ st: l.dataset.st, a: l.querySelector('.spla').textContent, d: l.querySelector('.spld').textContent, bar: !!l.querySelector('.spbar') }))`);
    ctx.assert.deepEqual(out.lanes.map(l => [l.a, l.st, l.bar]), [['Find every webhook handler', 'done', true], ['Check how retries are counted today', 'done', true], ['Load-test the queue prototype', 'fail', true]], 'by start, each on the clock');
    ctx.assert.match(out.lanes[0].d, /^done in \d+m$/, 'how long it took');
    ctx.assert.match(out.lanes[2].d, /^failed after \d+m$/, 'how it ended');
    ctx.assert.match(await ctx.evaluate(`document.querySelector('#spside .splane[data-st="fail"] .spll').textContent`), /API error/i, 'why it failed');
    await ctx.settle();
    await ctx.shot('space-lanes-dark');

    // the span: 15 m leaves out what ended before it, kept across a reload
    await ctx.evaluate(`document.querySelector('#spwin [data-w="15"]').click()`);
    await ctx.waitFor(`document.querySelector('#spwin [data-w="15"]').getAttribute('aria-pressed') === 'true'`, { what: 'the span' });
    ctx.assert.deepEqual(await ctx.evaluate(`[...document.querySelectorAll('#spside .splane')].map(l => !!l.querySelector('.spbar'))`), [false, false, true], 'the two that ended 19 and 16 m ago are off a 15 m clock');
    ctx.assert.equal(await ctx.evaluate(`peix.prefs().spWin`), 15, 'kept');

    // arrows move the pick
    await ctx.evaluate(`document.querySelector('#spgrid .sps.on').focus()`);
    const right = async () => { await ctx.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 }); await ctx.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 }); };
    await right();
    await ctx.waitFor(`/staging VPC/.test(document.querySelector('#spside h2').textContent)`, { what: 'the next chat picked' });
    await right();
    await ctx.waitFor(`/card payments/.test(document.querySelector('#spside h2').textContent)`, { what: 'the one after' });
    ctx.assert.equal(await ctx.evaluate(`document.activeElement.classList.contains('on')`), true, 'the keys on the chat picked');

    // a lane opens its agent's tab
    await ctx.evaluate(`document.querySelector('#spside .splane[data-ag="api"]').click()`);
    await ctx.waitFor(`!document.querySelector('#sp').open && !document.querySelector('#agv').hidden && /Backoff in the payments client/.test(document.querySelector('#agv .agvh').textContent)`, { what: 'its tab, Space closed' });
    ctx.assert.equal(await ctx.evaluate(`peix.state().current`), store.id, 'its chat open');

    // again: ⌥⌘S twice closes it
    await ctx.key('KeyS');
    await ctx.waitFor(`document.querySelector('#sp').open`, { what: 'open again' });
    await ctx.key('KeyS');
    await ctx.waitFor(`!document.querySelector('#sp').open`, { what: 'closed by the key again' });

    await ctx.key('KeyS');
    await ctx.waitFor(`document.querySelector('#sp').open`, { what: 'open for the light shot' });
    await ctx.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    await ctx.settle();
    await ctx.shot('space-light');
    await ctx.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: false });
    await ctx.settle();
    out.phone = await ctx.evaluate(`[...document.querySelectorAll('#sp *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => e.className || e.tagName)`);
    ctx.assert.deepEqual(out.phone, [], 'nothing past the edge at a phone\u2019s width');
    await ctx.shot('space-phone');
    return out;
  } finally { for (const s of sleeps) s.kill(); }
}
