// Luna (2026-11-27): the look of Windows XP. Worn, Tahoma for the words, the chat's header a title bar, the status bar a
// taskbar with a green start, the lanes task panes, the open row XP's selection blue, a question a yellow balloon, work
// a progress bar's blocks marching (`lunaprog`, phased) in the ring's place; Space a sky over a green hill, its nodes
// little windows, its agents square icons in a toolbar. Its dark half Luna Noir.
import { spawn } from 'node:child_process';
import { agentFiles, makeFixture, toolLines } from '../fixture.mjs';

export const meta = {
  server: true,
  fixture: 'auto',
  prefs: { theme: 'luna', skinFollow: false, look: 'light', cards: 'compact', spVisits: false, spOff: [] },
};

export default async function (ctx) {
  const out = {},
    now = Date.now(),
    cwd = ctx.fixture.chats[0].cwd,
    procs = [0, 1].map(() => spawn('sleep', ['300'], { stdio: 'ignore' }));
  try {
    const {
      chats: [work, ask],
    } = makeFixture(ctx.fixture.dir, [
      {
        cwd,
        title: 'Retry declined card payments',
        prompt: 'go',
        reply: 'On it.',
        at: new Date(now - 60_000),
        live: { pid: procs[0].pid, startedAt: now - 3_600_000, status: 'busy' },
        lines: id => toolLines({ id, cwd, name: 'Bash', input: { command: 'npm test' }, at: new Date(now - 30_000) }),
      },
      {
        cwd,
        title: 'Queue for invoice webhooks',
        prompt: 'pick',
        reply: 'Which?',
        at: new Date(now - 120_000),
        live: { pid: procs[1].pid, startedAt: now - 3_600_000, status: 'waiting', waitingFor: 'input needed' },
      },
    ]);
    agentFiles({
      dir: ctx.fixture.dir,
      lead: work,
      agents: [
        { id: 'map1', kind: 'Explore', asked: 'Find the retry paths', ago: 120_000, steps: ['List src/'] },
        { id: 'map2', kind: 'Explore', asked: 'Find the card errors', ago: 110_000, steps: ['Grep declined'] },
        {
          id: 'plan',
          kind: 'Plan',
          asked: 'Plan the backoff',
          ago: 300_000,
          steps: ['Read retry.ts'],
          report: 'Done.',
          finished: true,
          tool: 'toolu_plan',
          quiet: 200_000,
        },
      ],
    });
    await ctx.waitFor(
      `document.documentElement.dataset.skin === 'luna' && document.querySelector('#slist > .card.asking') && document.querySelector('#slist > .card.working')`,
      { what: 'Luna worn, a chat asking, one at work', timeout: 20000 },
    );
    out.look = await ctx.evaluate(`(() => {
      const css = (sel, prop, pseudo) => { const el = document.querySelector(sel); return el ? getComputedStyle(el, pseudo || null)[prop] : null; };
      return {
        font: css('body', 'fontFamily'),
        head: css('#shead', 'backgroundImage').slice(0, 15),
        start: css('#sbList', 'content', '::after'),
        balloon: css('#slist > .card.asking .state.needs-input', 'backgroundColor'),
        prog: css('#slist > .card.working > .rg', 'animationName', '::before'),
        lane: css('#slist .gsep.lane', 'backgroundImage').slice(0, 15),
      };
    })()`);
    ctx.assert.match(out.look.font, /Tahoma/, 'Tahoma');
    ctx.assert.equal(out.look.start, '"start"', 'the list switch a start button');
    ctx.assert.equal(out.look.balloon, 'rgb(255, 255, 225)', 'a question a yellow balloon');
    ctx.assert.equal(out.look.prog, 'lunaprog', 'work a progress bar');
    ctx.assert.match(out.look.lane, /linear-gradient/, 'a lane a task pane');
    out.phased = await ctx.evaluate(`document.getAnimations().some(a => a.animationName === 'lunaprog')`);
    ctx.assert.equal(out.phased, true);
    await ctx.openChat(work.id);
    await ctx.settle();
    out.head = await ctx.evaluate(`getComputedStyle(document.querySelector('#shead')).backgroundImage.slice(0, 15)`);
    ctx.assert.match(out.head, /linear-gradient/, 'the header a title bar');
    await ctx.shot('board');
    await ctx.openChat(ask.id);
    await ctx.settle();
    await ctx.shot('asking');

    await ctx.evaluate(`document.querySelector('#sbSpace').click()`);
    await ctx.waitFor(`document.querySelector('#spgrid .spt .spbox[data-st="work"]')`, { what: 'Space' });
    await ctx.settle();
    out.space = await ctx.evaluate(
      `[getComputedStyle(document.querySelector('#space .spsky')).backgroundImage.includes('gradient'), getComputedStyle(document.querySelector('#space .spbt')).position]`,
    );
    ctx.assert.deepEqual(out.space, [true, 'absolute'], 'a sky; a node a window with its title in the bar');
    await ctx.waitFor(`document.querySelectorAll('#space .sppod .spa').length >= 2`, {
      what: 'the agents round the node',
    });
    out.agents = await ctx.evaluate(
      `(a => [getComputedStyle(a).borderTopLeftRadius, getComputedStyle(document.querySelector('#space .sppod')).borderTopLeftRadius])(document.querySelector('#space .sppod .spa'))`,
    );
    ctx.assert.deepEqual(out.agents, ['2px', '3px'], 'its agents square icons in a toolbar');
    await ctx.settle();
    await ctx.shot('space');

    // the dark half
    await ctx.evaluate(`document.querySelector('#sbSpace').click()`);
    await ctx.evaluate(`peix.prefs(); document.querySelector('#lookPick [data-look="dark"]').click()`);
    await ctx.waitFor(`document.documentElement.dataset.skin === 'luna-noir'`, { what: 'Luna Noir' });
    await ctx.settle();
    await ctx.shot('noir');
    return out;
  } finally {
    for (const proc of procs) proc.kill();
  }
}
