// Phosphor (2026-11-27): an old green screen. Worn, every word but a terminal's is the system's monospace, every corner
// square, scanlines and a vignette lie over the window — Settings › Appearance › Scanlines takes them off, Glow lights
// the letters — and Space is a radar screen: a map grid for the sky, no stars, a sweep turning; Twinkling off stops it.
// A question still red, work still amber. Another theme: the two switches off, saying why.
import { spawn } from 'node:child_process';
import { makeFixture, toolLines } from '../fixture.mjs';

export const meta = {
  server: true,
  fixture: 'auto',
  prefs: { theme: 'phosphor', skinFollow: false, look: 'dark', cards: 'compact', spVisits: false, spOff: [] },
};

export default async function (ctx) {
  const out = {},
    now = Date.now(),
    cwd = ctx.fixture.chats[0].cwd,
    ps = [0, 1].map(() => spawn('sleep', ['300'], { stdio: 'ignore' }));
  try {
    const {
      chats: [work],
    } = makeFixture(ctx.fixture.dir, [
      {
        cwd,
        title: 'Retry declined card payments',
        prompt: 'go',
        reply: 'On it.',
        at: new Date(now - 60_000),
        live: { pid: ps[0].pid, startedAt: now - 3_600_000, status: 'busy' },
        lines: id => toolLines({ id, cwd, name: 'Bash', input: { command: 'npm test' }, at: new Date(now - 30_000) }),
      },
      {
        cwd,
        title: 'Queue for invoice webhooks',
        prompt: 'pick',
        reply: 'Which?',
        at: new Date(now - 120_000),
        live: { pid: ps[1].pid, startedAt: now - 3_600_000, status: 'waiting', waitingFor: 'input needed' },
      },
    ]);
    await ctx.waitFor(
      `document.documentElement.dataset.skin === 'phosphor' && document.querySelector('#slist > .card.asking')`,
      {
        what: 'Phosphor worn, a chat asking',
        timeout: 20000,
      },
    );
    const look = sel =>
      ctx.evaluate(
        `(e => e && { font: getComputedStyle(e).fontFamily, radius: getComputedStyle(e).borderTopLeftRadius })(document.querySelector(${JSON.stringify(sel)}))`,
      );
    out.card = await look('#slist > .card');
    ctx.assert.match(out.card.font, /monospace/, 'a card in monospace');
    ctx.assert.equal(out.card.radius, '0px', 'square');
    out.screen = await ctx.evaluate(`getComputedStyle(document.body, '::after').backgroundImage`);
    ctx.assert.match(out.screen, /repeating-linear-gradient/, 'scanlines over the window');
    out.inks = await ctx.evaluate(
      `['--ink', '--needs', '--working-ink', '--bg'].map(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim())`,
    );
    ctx.assert.equal(out.inks[0], '#5cff93', 'one green ink');
    await ctx.settle();
    await ctx.shot('board');
    await ctx.openChat(ctx.fixture.chats[1].id);
    await ctx.settle();
    await ctx.shot('chat');
    await ctx.openChat(work.id);

    // the switches: Scanlines off, Glow on; another theme, both off with why
    await ctx.evaluate(`document.querySelector('#crtOn').click(); document.querySelector('#glowOn').click()`);
    await ctx.waitFor(
      `document.documentElement.dataset.crt === 'off' && document.documentElement.dataset.glow === 'on' && getComputedStyle(document.body, '::after').content === 'none' && getComputedStyle(document.body).textShadow !== 'none'`,
      { what: 'scanlines off, the glow on' },
    );
    ctx.assert.deepEqual(
      [await ctx.evaluate(`peix.prefs().crt`), await ctx.evaluate(`peix.prefs().crtGlow`)],
      [false, true],
    );
    await ctx.evaluate(`document.querySelector('#crtOn').click(); document.querySelector('#glowOn').click()`);
    await ctx.evaluate(`document.querySelector('#themePick [data-fam="nord"]').click()`);
    await ctx.waitFor(
      `document.documentElement.dataset.skin === 'nord' && document.querySelector('#crtOn').disabled && !/monospace/.test(getComputedStyle(document.querySelector('#slist > .card')).fontFamily)`,
      { what: 'another theme: the switches off, its own type', timeout: 5000 },
    );
    out.other = await ctx.evaluate(
      `[document.querySelector('#crtRow').classList.contains('off'), document.querySelector('#crtRow small').textContent, getComputedStyle(document.body, '::after').content, getComputedStyle(document.querySelector('#slist > .card')).fontFamily, getComputedStyle(document.body).fontFamily, document.querySelector('#slist > .card').className]`,
    );
    ctx.assert.deepEqual(out.other.slice(0, 3), [true, 'Only in Phosphor', 'none'], 'off, saying why; no scanlines');
    ctx.assert.doesNotMatch(out.other[3], /monospace/, 'its own type: ' + out.other.slice(3).join(' | '));
    await ctx.evaluate(`document.querySelector('#themePick [data-fam="phosphor"]').click()`);
    await ctx.waitFor(`document.documentElement.dataset.skin === 'phosphor'`, { what: 'Phosphor again' });

    // Space: a radar screen
    await ctx.evaluate(`peix.prefs().space || document.querySelector('#sbSpace').click()`);
    await ctx.waitFor(
      `document.querySelector('#spgrid .spbox[data-st="work"]') && document.querySelector('#spgrid .spbox[data-st="ask"]')`,
      {
        what: 'Space, its nodes',
      },
    );
    out.space = await ctx.evaluate(`({
      sweep: getComputedStyle(document.querySelector('#spsky .spsweep')).animationName,
      stars: getComputedStyle(document.querySelector('#spsky > b')).display,
      grid: getComputedStyle(document.querySelector('#spsky')).backgroundImage.includes('linear-gradient'),
      node: getComputedStyle(document.querySelector('#spgrid .spbox')).borderTopLeftRadius,
      ask: getComputedStyle(document.querySelector('#spgrid .spbox[data-st="ask"]')).borderTopColor,
    })`);
    ctx.assert.deepEqual(
      [out.space.sweep, out.space.stars, out.space.grid, out.space.node],
      ['spsweep', 'none', true, '0px'],
      'a sweep turning, no stars, the grid, square nodes',
    );
    await ctx.settle();
    await ctx.sleep(1500);
    await ctx.shot('space');
    await ctx.evaluate(`document.querySelector('#twinkleOn')?.click()`);
    return out;
  } finally {
    for (const p of ps) p.kill();
  }
}
