// Casa do Professor (2026-11-27; `professor` in the code): a constructivist poster. Worn, every corner square, the lane heads,
// the project's tab, the title and the status bar in condensed capitals, a red wedge before each lane, the status bar a
// red band with the hammer and sickle, the emblem large and faint behind the chat, and Space's sky rays rising from it.
// Its light half the poster's paper. A question still its own red.
import { spawn } from 'node:child_process';
import { makeFixture, toolLines } from '../fixture.mjs';

export const meta = {
  server: true,
  fixture: 'auto',
  prefs: { theme: 'professor', skinFollow: false, look: 'dark', cards: 'compact', spVisits: false, spOff: [] },
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
      `document.documentElement.dataset.skin === 'professor' && document.querySelector('#slist > .card.asking')`,
      { what: 'Casa do Professor worn, a chat asking', timeout: 20000 },
    );
    out.look = await ctx.evaluate(`({
      radius: getComputedStyle(document.querySelector('#slist > .card')).borderTopLeftRadius,
      lane: (e => [getComputedStyle(e).textTransform, getComputedStyle(e).fontFamily, getComputedStyle(e, '::before').backgroundImage.slice(0, 15)])(document.querySelector('#slist .gsep.lane .ln')),
      bar: getComputedStyle(document.querySelector('#sbar')).backgroundColor,
      emblem: getComputedStyle(document.querySelector('#sbLeft'), '::before').maskImage.slice(0, 30),
      ink: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),
    })`);
    ctx.assert.equal(out.look.radius, '0px', 'square');
    ctx.assert.equal(out.look.lane[0], 'uppercase', 'the lane heads in capitals');
    ctx.assert.match(out.look.lane[1], /Condensed/, 'in a condensed face');
    ctx.assert.match(out.look.lane[2], /linear-gradient/, 'a wedge before them');
    ctx.assert.ok((([r, g]) => r > 200 && g < 90)(out.look.bar.match(/\d+/g).map(Number)), 'the status bar a red band');
    ctx.assert.match(out.look.emblem, /svg/, 'the hammer and sickle on it');
    ctx.assert.equal(out.look.ink, '#efe4cc', 'cream ink');
    await ctx.settle();
    await ctx.shot('board');
    await ctx.openChat(work.id);
    await ctx.settle();
    out.watermark = await ctx.evaluate(
      `getComputedStyle(document.querySelector('.gbody.haslog'), '::before').maskImage.slice(0, 30)`,
    );
    ctx.assert.match(out.watermark, /svg/, 'the emblem behind the chat');
    await ctx.shot('chat');

    // the light half: the poster's paper
    await ctx.evaluate(`document.querySelector('#lookPick [data-look="light"]').click()`);
    await ctx.waitFor(`document.documentElement.dataset.skin === 'professor-poster'`, { what: 'the poster half' });
    out.light = await ctx.evaluate(
      `[document.documentElement.dataset.theme, getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()]`,
    );
    ctx.assert.deepEqual(out.light, ['light', '#1a1614'], 'black type on paper');
    await ctx.settle();
    await ctx.shot('poster');

    // Space: rays, the emblem their sun, no stars
    await ctx.evaluate(`document.querySelector('#lookPick [data-look="dark"]').click()`);
    await ctx.evaluate(`document.querySelector('#settings')?.open && document.querySelector('#settings').close()`);
    await ctx.evaluate(`document.querySelector('#sbSpace').click()`);
    await ctx.waitFor(`document.querySelector('#spgrid .spt')`, { what: 'Space' });
    await ctx.settle();
    out.space = await ctx.evaluate(
      `(s => [getComputedStyle(s).backgroundImage.includes('conic'), getComputedStyle(s, '::after').maskImage.slice(0, 20), getComputedStyle(document.querySelector('#space .sphd h1'), '::before').maskImage.slice(0, 20)])(document.querySelector('#space .spsky'))`,
    );
    ctx.assert.equal(out.space[0], true, 'rays');
    ctx.assert.match(out.space[1], /svg/, 'the emblem their sun');
    await ctx.shot('space');
    return out;
  } finally {
    for (const p of ps) p.kill();
  }
}
