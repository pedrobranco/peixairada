// Space (⌥⌘S, 2026-11-18): the board's other layout. Off at first; the status bar's Space or ⌥⌘S puts it on: Space on top,
// the chat below. Each chat of the project in view a node — its name, its folder, its edge its state — with a pod per
// agent type docked to it, each agent its type's letters in its type's colour (the definition's), its state a badge or a
// turning arc; the states on top filter it (Idle and Done off at first). No chat open, Space takes the column; a click on
// a node opens the chat below it, whose agents become lanes on one clock; a lane opens its agent's tab. Every key is the
// board's: ⌥⌘N's picker comes up over Space. The divider's place and Space itself outlive a reload. ⌥⌘S again leaves it.
// Shots dark and light.
import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { agentFiles, agentNoteLine, makeFixture } from '../fixture.mjs';
import { tmpDir } from '../../lib/testserver.mjs';
import { ANIM_RULES } from '../../lib/animcheck.mjs';

export const meta = { server: true, fixture: 'auto', prefs: { cards: 'compact', lanesShut: [] } };
const MIN = 60_000;

export default async function (ctx) {
  const out = {}, now = Date.now(), root = realpathSync(tmpDir('peix-sp-')), sleeps = [0, 1, 2, 3, 4].map(() => spawn('sleep', ['300'], { stdio: 'ignore' }));
  const live = (i, more = {}) => ({ pid: sleeps[i].pid, startedAt: now - 90 * MIN, ...more });
  const dir = name => { const d = join(root, name); mkdirSync(d, { recursive: true }); return d; };
  const projects = { 'billing-api': { color: '#3d9a6a' }, infra: { color: '#8b6cf0' }, storefront: { color: '#4a86e8' }, 'mobile-app': { color: '#e0883a' } };
  await ctx.server.api('api/config', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ projects }) });
  // two agent types defined with a colour, as Claude Code reads them: the user's agents folder
  mkdirSync(join(ctx.fixture.dir, 'agents'), { recursive: true });
  writeFileSync(join(ctx.fixture.dir, 'agents', 'security.md'), '---\nname: security\ndescription: Reviews for security\ncolor: red\n---\nLook for what is too wide.\n');
  writeFileSync(join(ctx.fixture.dir, 'agents', 'cost.md'), '---\nname: cost\ndescription: Prices things\ncolor: green\n---\nPrice it.\n');
  const nodes = () => ctx.evaluate(`[...document.querySelectorAll('#spgrid .spt')].map(b => ({ title: b.querySelector('.spbt').textContent, folder: b.querySelector('.spbf')?.textContent || '', st: b.querySelector('.spbox').dataset.st, on: b.classList.contains('on'),
    pods: [...b.querySelectorAll('.sppod')].map(p => ({ label: p.nextElementSibling.textContent, h: p.style.getPropertyValue('--h'), marks: [...p.querySelectorAll('.spa')].map(a => a.textContent + ':' + a.dataset.st).join(' ') })) }))`);
  try {
    const { chats } = makeFixture(ctx.fixture.dir, [
      { cwd: dir('infra'), title: 'Review the staging VPC plan from every angle before we apply it', prompt: 'review the plan', reply: 'Sending reviewers out.', at: new Date(now - 12 * MIN), live: live(0) },
      { cwd: dir('billing-api'), title: 'Queue for invoice webhooks', prompt: 'move the webhooks to a queue', reply: 'Which queue should they go on?', at: new Date(now - 25 * MIN), live: live(1, { status: 'waiting', waitingFor: 'permission prompt' }) },
      { cwd: dir('storefront'), title: 'Retry declined card payments with backoff', prompt: 'retry them', reply: 'On it.', at: new Date(now - 20 * MIN), live: live(2) },
      { cwd: join(root, 'storefront'), title: 'Product grid follows the dark theme', prompt: 'fix the grid', reply: 'Done, 14 tests pass.', at: new Date(now - 40 * MIN), live: live(3) },
      { cwd: dir('mobile-app'), title: 'Bump the build number', prompt: 'bump it', reply: 'Bumped on both apps.', at: new Date(now - 30 * MIN), live: live(4) },
    ]);
    const [infra, billing, store] = chats;
    agentFiles({ dir: ctx.fixture.dir, lead: infra, agents: [
      { id: 'sec1', kind: 'security', asked: 'Look for open ingress', ago: 11 * MIN, steps: ['Grep 0.0.0.0/0 in modules/'] },
      { id: 'sec2', kind: 'security', asked: 'Look for wide IAM policies', ago: 11 * MIN, steps: ['Read iam.tf'] },
      { id: 'cost', kind: 'cost', asked: 'Price the NAT gateways', ago: 10 * MIN, steps: ['Read plan/staging.json'] },
      { id: 'map', kind: 'Explore', asked: 'Find every module that uses the VPC', ago: 9 * MIN, steps: ['List modules/'], quiet: 4 * MIN },
    ] });
    agentFiles({ dir: ctx.fixture.dir, lead: billing, agents: [
      { id: 'find', asked: 'Find every webhook handler', ago: 24 * MIN, steps: ['List src/webhooks/'], report: 'Seven handlers.', finished: true, tool: 'toolu_find', quiet: 19 * MIN },
      { id: 'load', asked: 'Load-test the queue prototype', ago: 21 * MIN, steps: ['k6 run scripts/queue.js'], finished: true, tool: 'toolu_load', quiet: 12 * MIN },
    ] });
    appendFileSync(billing.file, JSON.stringify(agentNoteLine({ id: billing.id, cwd: billing.cwd, tool: 'toolu_load', asked: 'Load-test the queue prototype', status: 'failed', said: 'failed: Agent terminated early due to an API error', at: new Date(now - 12 * MIN).toISOString() })) + '\n');
    agentFiles({ dir: ctx.fixture.dir, lead: store, agents: [
      { id: 'api', asked: 'Backoff in the payments client', ago: 18 * MIN, steps: ['Edit src/payments/retry.ts'] },
    ] });
    await ctx.waitFor(`(peix.session('${infra.id}')?.agentRows || []).length === 4 && (peix.session('${billing.id}')?.agentRows || []).some(r => r.st === 'fail') && (peix.session('${store.id}')?.agentRows || []).length === 1`, { what: 'every chat’s agents', timeout: 20000 });
    ctx.assert.equal(await ctx.evaluate(`peix.session('${infra.id}').agentRows.find(r => r.id === 'sec1').color`), 'red', 'a row carries its type’s colour, from its definition');
    ctx.assert.equal(await ctx.evaluate(`!!document.querySelector('#main.space') || !document.querySelector('#space').hidden`), false, 'off at first');

    // on, by the status bar's button: no chat open, Space takes the column
    await ctx.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
    await ctx.evaluate(`document.querySelector('#sbSpace').click()`);
    await ctx.waitFor(`document.querySelector('#main').classList.contains('space') && document.querySelectorAll('#spgrid .spt').length === 7`, { what: 'Space on, a node a chat (the five, and the auto fixture\u2019s two)' });
    ctx.assert.equal(await ctx.evaluate(`document.querySelector('#main').classList.contains('spfull') && getComputedStyle(document.querySelector('#chat')).display`), 'none', 'no chat open: Space takes the column');
    ctx.assert.equal(await ctx.evaluate(`document.querySelector('#sbSpace').getAttribute('aria-pressed')`), 'true', 'its button lit');
    ctx.assert.deepEqual(await ctx.evaluate(`[getComputedStyle(document.querySelector('#sessions')).display, document.querySelector('#sbList').getAttribute('aria-pressed')]`), ['none', 'false'], 'Space or the list, never both: the list gone, its button off');
    out.nodes = await nodes();
    const by = t => out.nodes.find(n => n.title.startsWith(t));
    ctx.assert.equal(by('Review the staging').title, 'Review the staging VPC plan from every angle before we apply…', 'a name past 60 characters cut');
    ctx.assert.match(by('Review the staging').folder, /infra$/, 'its folder under its name');
    ctx.assert.equal(by('Queue for invoice').st, 'ask', 'asking: its edge red');
    ctx.assert.deepEqual(by('Review the staging').pods.map(p => [p.label, p.h, p.marks]), [
      ['security', '25', 'SE:run SE:run'], ['cost', '150', 'CO:run'], ['Explore', by('Review the staging').pods[2].h, 'EX:quiet'],
    ], 'a pod per type, the most first; its letters, its colour (the definition’s hue), its state');
    ctx.assert.deepEqual(by('Queue for invoice').pods.map(p => p.marks), ['GP:done GP:fail'], 'two of one type: one pod');
    await ctx.settle();
    await ctx.shot('space-dark');
    ctx.assert.deepEqual(await ctx.evaluate(ANIM_RULES), [], 'its arcs and pings keep the compositor\u2019s rules');

    // the states on top filter it: Ready off, its two chats gone; Idle and Done start off
    out.filters = await ctx.evaluate(`[...document.querySelectorAll('#spfs .spf')].map(f => f.dataset.k + ':' + f.getAttribute('aria-pressed') + ':' + f.querySelector('b').textContent).join(' ')`);
    ctx.assert.equal(out.filters, 'ask:true:1 work:true:2 watch:true:0 ready:true:4 idle:false:0 done:false:0', 'a toggle a state, its count');
    await ctx.evaluate(`document.querySelector('#spfs .spf[data-k="ready"]').click()`);
    await ctx.waitFor(`document.querySelectorAll('#spgrid .spt').length === 3`, { what: 'the four ready chats left out' });
    ctx.assert.deepEqual(await ctx.evaluate(`peix.prefs().spOff`), ['idle', 'done', 'ready'], 'kept');
    await ctx.evaluate(`document.querySelector('#spfs .spf[data-k="ready"]').click()`);
    await ctx.waitFor(`document.querySelectorAll('#spgrid .spt').length === 7`, { what: 'back' });

    // a click on a node opens its chat below; its agents become lanes
    await ctx.evaluate(`document.querySelector('#spgrid .spt[data-id="${billing.id}"]').click()`);
    await ctx.waitFor(`peix.state().current === '${billing.id}' && !document.querySelector('#main').classList.contains('spfull') && getComputedStyle(document.querySelector('#chat')).display !== 'none'`, { what: 'the chat below' });
    await ctx.waitFor(`document.querySelector('#spgrid .spt[data-id="${billing.id}"]').classList.contains('on') && document.querySelectorAll('#spside .splane').length === 2`, { what: 'its node lit, its lanes' });
    out.geom = await ctx.evaluate(`(() => { const s = document.querySelector('#space').getBoundingClientRect(), c = document.querySelector('#chat').getBoundingClientRect(); return { below: c.top >= s.bottom, side: Math.abs(c.left - s.left) <= 8 && Math.abs(c.right - s.right) <= 8 }; })()`);
    ctx.assert.deepEqual(out.geom, { below: true, side: true }, 'the chat under Space, its width (a tile\u2019s inset aside)');
    ctx.assert.match(await ctx.evaluate(`document.querySelector('#spside .splane[data-st="fail"] .spll').textContent`), /API error/i, 'why it failed');
    await ctx.settle();
    await ctx.shot('space-chat-dark');

    // every key is the board's: ⌥⌘N's picker over Space
    await ctx.key('KeyN');
    await ctx.waitFor(`document.querySelector('#pick').open`, { what: '⌥⌘N’s picker' });
    await ctx.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await ctx.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await ctx.waitFor(`!document.querySelector('#pick').open`, { what: 'the picker closed' });
    ctx.assert.equal(await ctx.evaluate(`document.querySelector('#main').classList.contains('space')`), true, 'Space still on');

    // a lane opens its agent's tab, in the chat below
    await ctx.evaluate(`document.querySelector('#spgrid .spt[data-id="${infra.id}"]').click()`);
    await ctx.waitFor(`peix.state().current === '${infra.id}' && !!document.querySelector('#spside .splane[data-ag="sec1"]')`, { what: 'its lanes' });
    await ctx.evaluate(`document.querySelector('#spside .splane[data-ag="sec1"]').click()`);
    await ctx.waitFor(`!document.querySelector('#agv').hidden && /Look for open ingress/.test(document.querySelector('#agv .agvh').textContent)`, { what: 'its tab below' });

    // the divider, dragged: kept with Space across a reload
    const r = await ctx.evaluate(`(() => { const d = document.querySelector('#spdiv').getBoundingClientRect(), m = document.querySelector('#main').getBoundingClientRect(); return { x: d.left + d.width / 2, y: d.top + d.height / 2, to: m.top + m.height * .4 }; })()`);
    await ctx.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: r.x, y: r.y, button: 'left', clickCount: 1 });
    await ctx.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: (r.y + r.to) / 2, button: 'left', buttons: 1 });
    await ctx.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: r.x, y: r.to, button: 'left', buttons: 1 });
    await ctx.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: r.x, y: r.to, button: 'left', clickCount: 1 });
    out.at = await ctx.evaluate(`peix.prefs().spaceAt`);
    ctx.assert.ok(Math.abs(out.at - .4) < .03, `the divider dragged to 40 % (${out.at})`);
    await ctx.reload();
    await ctx.waitFor(`document.querySelector('#main').classList.contains('space') && document.querySelectorAll('#spgrid .spt').length === 7`, { what: 'Space back after the reload' });
    ctx.assert.equal(await ctx.evaluate(`document.querySelector('#main').style.getPropertyValue('--sp')`), String(out.at), 'its share kept');

    // the list's button leaves Space for the list; ⌥⌘S takes its place again
    await ctx.evaluate(`document.querySelector('#sbList').click()`);
    await ctx.waitFor(`!document.querySelector('#main').classList.contains('space') && getComputedStyle(document.querySelector('#sessions')).display !== 'none'`, { what: 'the list back, Space gone' });
    ctx.assert.deepEqual(await ctx.evaluate(`[document.querySelector('#sbList').getAttribute('aria-pressed'), document.querySelector('#sbSpace').getAttribute('aria-pressed'), peix.prefs().space]`), ['true', 'false', false], 'each button says which');
    await ctx.key('KeyS');
    await ctx.waitFor(`document.querySelector('#main').classList.contains('space') && getComputedStyle(document.querySelector('#sessions')).display === 'none'`, { what: 'Space in the list\u2019s place again' });
    // ⌥⌘S leaves it: the board as it was
    await ctx.key('KeyS');
    await ctx.waitFor(`!document.querySelector('#main').classList.contains('space') && document.querySelector('#space').hidden`, { what: 'Space off' });
    await ctx.key('KeyS');
    await ctx.waitFor(`document.querySelector('#main').classList.contains('space')`, { what: 'on again' });
    await ctx.openChat(infra.id);
    await ctx.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    await ctx.settle();
    await ctx.shot('space-chat-light');
    return out;
  } finally { for (const s of sleeps) s.kill(); }
}
