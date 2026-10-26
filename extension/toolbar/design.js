// Design MD: a measured design reference of the page (colours, type scale, spacing, radii, shadows,
// breakpoints, containers, motion, buttons) shown visually and as Markdown, downloadable as DESIGN.md or
// as a SKILL.md for coding agents. Everything comes from computed styles, so it describes what renders,
// not how the source CSS names it.
(() => {
  const { h, button } = MUI;
  let panel = null;
  let data = null;
  let view = 'visual';
  let kind = 'design';

  const num = (v) => parseFloat(v) || 0;
  const r2 = (n) => Math.round(n * 100) / 100;
  const pxRem = (p) => `${r2(p)}px / ${r2(p / 16)}rem`;
  const inc = (map, key, n = 1) => map.set(key, (map.get(key) || 0) + n);
  const top = (map, n) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n);
  const unquote = (s) => s.trim().replace(/^["']+|["']+$/g, '');
  const firstPart = (v) => v.split(/,(?![^(]*\))/)[0].trim();
  const slug = (s) => s.toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site';
  const alpha = (c) => { const m = /rgba\([^)]*,\s*([\d.]+)\)/.exec(c); return m ? +m[1] : 1; };

  async function collect() {
    const colors = MUI.scanColors();
    const fonts = MUI.scanFonts();
    const types = new Map();
    const spacing = new Map(), radii = new Map(), shadows = new Map(), containers = new Map();
    const durations = new Map(), easings = new Map(), buttons = new Map();
    let elements = 0;
    for (const el of MUI.visibleElements()) {
      elements++;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden') continue;
      // text split into spans (reveal animations) still belongs to its heading
      const heading = el.closest('h1, h2, h3, h4, h5, h6');
      const tag = heading ? heading.tagName.toLowerCase() : el.tagName.toLowerCase();
      if (MUI.hasOwnText(el)) {
        const key = [cs.fontSize, cs.fontWeight, cs.lineHeight, cs.letterSpacing, unquote(cs.fontFamily.split(',')[0])].join('|');
        let t = types.get(key);
        if (!t) types.set(key, (t = { size: num(cs.fontSize), weight: cs.fontWeight, lh: cs.lineHeight, ls: cs.letterSpacing,
          family: unquote(cs.fontFamily.split(',')[0]), count: 0, tags: new Map(), sample: '' }));
        t.count++;
        inc(t.tags, /^h[1-6]$/.test(tag) || ['a', 'button', 'label', 'small', 'p', 'li'].includes(tag) ? tag : 'text');
        if (!t.sample) t.sample = el.textContent.trim().replace(/\s+/g, ' ').slice(0, 48);
      }
      for (const p of ['padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right',
        'margin-bottom', 'margin-left', 'row-gap', 'column-gap']) {
        const v = num(cs.getPropertyValue(p));
        if (v > 0 && v < 400 && !(p.startsWith('margin') && cs.getPropertyValue(p) === 'auto')) inc(spacing, Math.round(v * 4) / 4);
      }
      if (cs.borderRadius !== '0px') inc(radii, cs.borderRadius);
      // a shadow with a huge spread is a backdrop trick (painting the page around a box), not an elevation token
      const spreads = [...cs.boxShadow.matchAll(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px/g)].map((m) => +m[4]);
      if (cs.boxShadow !== 'none' && !spreads.some((s) => s > 200)) inc(shadows, cs.boxShadow);
      const mw = num(cs.maxWidth);
      if (mw > 300 && cs.maxWidth.endsWith('px') && Math.abs(num(cs.marginLeft) - num(cs.marginRight)) < 1) inc(containers, mw);
      if (num(cs.transitionDuration) > 0) {
        const d = firstPart(cs.transitionDuration);
        inc(durations, d.endsWith('ms') ? `${num(d)}ms` : `${r2(num(d) * 1000)}ms`);
        inc(easings, firstPart(cs.transitionTimingFunction));
      }
      const buttonish = tag === 'button' || el.getAttribute('role') === 'button' || (tag === 'a' && num(cs.paddingLeft) >= 8)
        || (tag === 'input' && ['submit', 'button'].includes(el.type));
      const filled = alpha(cs.backgroundColor) > 0 || num(cs.borderTopWidth) > 0;
      if (buttonish && filled && el.textContent.trim()) {
        const sig = [cs.backgroundColor, cs.color, cs.borderRadius, cs.padding, cs.fontSize, cs.fontWeight, cs.border].join('|');
        let b = buttons.get(sig);
        if (!b) buttons.set(sig, (b = { cs: { background: cs.backgroundColor, color: cs.color, radius: cs.borderRadius,
          padding: cs.padding, font: `${cs.fontSize} / ${cs.fontWeight}`, border: num(cs.borderTopWidth) ? cs.borderTop : 'none',
          family: cs.fontFamily, size: cs.fontSize, weight: cs.fontWeight }, count: 0, example: MUI.describe(el),
        text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 24) }));
        b.count++;
      }
    }

    // breakpoints from @media rules, readable sheets via the CSSOM, cross-origin ones fetched
    const breakpoints = new Map();
    const addQuery = (q) => {
      for (const m of q.matchAll(/(min|max)-width\s*:\s*([\d.]+)(px|em|rem)/g)) {
        inc(breakpoints, `${m[1]}-width: ${m[3] === 'px' ? +m[2] : +m[2] * 16}px`);
      }
    };
    const walk = (rules) => {
      for (const rule of rules) {
        if (rule.media && rule.cssRules) addQuery(rule.media.mediaText);
        if (rule.cssRules) walk(rule.cssRules);
      }
    };
    for (const sheet of await MUI.styleSheets()) {
      if (sheet.rules) walk(sheet.rules);
      else for (const m of sheet.text.matchAll(/@media([^{]+)\{/g)) addQuery(m[1]);
    }

    // token names as Pick names them, so this reference and cloned components agree
    const theme = new MirrorUICompile.Theme();
    for (const c of colors) if (c.hex.length === 7) theme.colors.set(c.hex, c.count);
    theme.finalize();
    for (const f of fonts) theme.font(f.stack);

    // roles for the type scale: headings by tag, body = the most common running-text style
    const scale = [...types.values()].sort((a, b) => b.size - a.size || b.count - a.count).slice(0, 14);
    const textTags = (t) => ['p', 'li', 'text'].reduce((n, k) => n + (t.tags.get(k) || 0), 0);
    const body = [...types.values()].sort((a, b) => textTags(b) - textTags(a))[0];
    for (const t of scale) {
      const mainTag = top(t.tags, 1)[0][0];
      t.role = /^h[1-6]$/.test(mainTag) ? mainTag.toUpperCase() : t === body ? 'Body'
        : ['a', 'button'].includes(mainTag) ? 'Link / button' : body && t.size > body.size ? 'Large text' : 'Small text';
    }

    const spacingList = top(spacing, 14).sort((a, b) => a[0] - b[0]);
    const total = [...spacing.values()].reduce((a, b) => a + b, 0) || 1;
    const share = (unit) => [...spacing].filter(([v]) => v % unit === 0).reduce((a, [, n]) => a + n, 0) / total;
    const base = share(8) > 0.8 ? 8 : share(4) > 0.8 ? 4 : null;

    return {
      title: document.title, url: location.href, host: location.hostname, date: new Date().toISOString().slice(0, 10),
      viewport: `${innerWidth} × ${innerHeight}`, elements, colors, fonts, theme, scale, spacing: spacingList, base,
      baseShare: base ? Math.round(share(base) * 100) : null,
      radii: top(radii, 8), shadows: top(shadows, 6),
      breakpoints: top(breakpoints, 10).sort((a, b) => num(a[0].split(':')[1]) - num(b[0].split(':')[1])),
      containers: top(containers, 6), durations: top(durations, 6), easings: top(easings, 4),
      buttons: [...buttons.values()].sort((a, b) => b.count - a.count).slice(0, 4),
    };
  }

  // ---------------------------------------------------------------- markdown

  const table = (head, rows) => rows.length ? [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n') : '_None measured._';
  const code = (s) => `\`${String(s).replace(/`/g, "'")}\``;
  const ROLE = { text: 'text', background: 'background', border: 'border', svg: 'icons' };

  function markdown(d) {
    const out = [`# Design reference: ${d.title || d.host}`, '',
      `Source: ${d.url}  `,
      `Measured ${d.date} at ${d.viewport} from ${d.elements} rendered elements with MirrorUI. Values are what the browser computed, not the source CSS, so names are inferred.`,
      '', '## Colors', '',
      table(['Token', 'Hex', 'Used for', 'Count'], d.colors.slice(0, 18).map((c) => [
        d.theme.names.get(c.hex) ? code(d.theme.names.get(c.hex)) : '-', code(c.hex),
        [...c.roles].map((r) => ROLE[r]).join(', '), c.count])),
      '', '## Typography', '', '### Families', '',
      ...d.fonts.map((f) => `- **${f.name}**: ${f.web ? 'web font' : 'system font'}, weights ${[...f.weights.keys()].sort().join(' / ')}, ${f.count} text elements. Stack: ${code(f.stack)}`),
      '', '### Type scale', '',
      table(['Role', 'Size', 'Line height', 'Weight', 'Tracking', 'Family', 'Example'], d.scale.map((t) => [
        t.role, pxRem(t.size), t.lh, t.weight, t.ls, t.family, t.sample ? `“${t.sample.replace(/\|/g, '/')}”` : ''])),
      '', '## Spacing', '',
      d.base ? `Base unit: ${d.base}px (${d.baseShare}% of measured padding, margin and gap values are multiples of ${d.base}).` : 'No single base unit: values don’t share a common step.',
      '', table(['Value', 'Count'], d.spacing.map(([v, n]) => [`${v}px`, n])),
      '', '## Radii', '', table(['Value', 'Count'], d.radii.map(([v, n]) => [code(v), n])),
      '', '## Shadows', '', table(['Value', 'Count'], d.shadows.map(([v, n]) => [code(v), n])),
      '', '## Breakpoints', '', table(['Media query', 'Rules'], d.breakpoints.map(([v, n]) => [code(v), n])),
      '', '## Layout', '', d.containers.length ? `Centred containers (max-width): ${d.containers.map(([v, n]) => `${v}px ×${n}`).join(', ')}.` : '_No centred max-width containers measured._',
      '', '## Motion', '',
      d.durations.length ? `Durations: ${d.durations.map(([v, n]) => `${v} ×${n}`).join(', ')}.  \nEasings: ${d.easings.map(([v, n]) => `${code(v)} ×${n}`).join(', ')}.` : '_No transitions measured._',
      '', '## Buttons', '',
      ...(d.buttons.length ? d.buttons.flatMap((b, i) => [`### Button ${i + 1}: ${code(b.example)} ×${b.count}`, '',
        `- Background ${code(MUI.hex(b.cs.background) || b.cs.background)}, text ${code(MUI.hex(b.cs.color) || b.cs.color)}`,
        `- Radius ${code(b.cs.radius)}, padding ${code(b.cs.padding)}, font ${code(b.cs.font)}, border ${code(b.cs.border)}`, '']) : ['_No buttons measured._', '']),
      '## Tailwind v4 theme', '', '```css', d.theme.css(), '```', '',
      '## Capture coverage', '',
      '- Only what is rendered at this viewport width is measured; other breakpoints may use other values.',
      '- Hover, focus and active states are not sampled here; Pick and Inspect read hover states per element.',
      '- Colors inside images, canvas and gradients are not included.', ''];
    return out.join('\n');
  }

  function skill(d) {
    const name = `${slug(d.host)}-design`;
    return ['---', `name: ${name}`,
      `description: Design system of ${d.host} measured with MirrorUI (colors, type scale, spacing, radii, shadows, breakpoints). Use when building or reviewing UI that should look like ${d.host}.`,
      '---', '',
      `When building UI for ${d.host}, use the tokens and scales below instead of inventing values. Prefer the Tailwind theme at the end; map spacing to the base unit, use the listed type scale roles for headings and body text, and reuse the button styles.`,
      '', markdown(d)].join('\n');
  }

  // ---------------------------------------------------------------- visual

  function visual(d) {
    const sec = (title, ...kids) => [h('div', { class: 'section', text: title }), ...kids];
    const names = d.theme.names;
    return [
      ...sec('Colors', h('div', { class: 'swatches' }, d.colors.slice(0, 18).map((c) => h('div', { class: 'swatch' },
        h('div', { class: 'chip-color', style: { background: c.hex } }),
        h('div', { class: 'small' }, h('b', { text: names.get(c.hex) || c.hex }), h('div', { class: 'muted', text: `${c.hex} · ${c.count}` })))))),
      ...sec('Type scale', d.scale.map((t) => h('div', { class: 'spec' },
        h('div', { class: 'muted small', text: `${t.role} · ${r2(t.size)}px · ${t.weight} · ${t.lh} · ${t.family}` }),
        h('div', { class: 'spec-text', style: { fontFamily: `"${t.family}"`, fontSize: `${Math.min(t.size, 44)}px`, fontWeight: t.weight,
          letterSpacing: t.ls === 'normal' ? null : t.ls, lineHeight: 1.15 }, text: t.sample || 'The quick brown fox' })))),
      ...sec(`Spacing${d.base ? ` · base ${d.base}px` : ''}`, d.spacing.map(([v, n]) => h('div', { class: 'bar-row' },
        h('span', { class: 'muted small', text: `${v}px` }), h('div', { class: 'space-bar', style: { width: `${Math.min(v, 260)}px` } }),
        h('span', { class: 'muted small', text: `×${n}` })))),
      ...sec('Radii', h('div', { class: 'tiles' }, d.radii.map(([v, n]) => h('div', { class: 'tile' },
        h('div', { class: 'rbox', style: { borderRadius: v } }), h('div', { class: 'muted small', text: `${v.split(' ')[0]} ×${n}` }))))),
      ...(d.shadows.length ? sec('Shadows', h('div', { class: 'tiles' }, d.shadows.map(([v, n]) => h('div', { class: 'tile' },
        h('div', { class: 'sbox', style: { boxShadow: v } }), h('div', { class: 'muted small', text: `×${n}` }))))) : []),
      ...sec('Breakpoints', h('div', { class: 'chips' }, d.breakpoints.length ? d.breakpoints.map(([v, n]) => h('span', { class: 'chip', text: `${v} ×${n}` }))
        : h('span', { class: 'muted small', text: 'None found' }))),
      ...(d.durations.length ? sec('Motion', h('div', { class: 'chips' }, d.durations.concat(d.easings).map(([v, n]) => h('span', { class: 'chip', text: `${v} ×${n}` })))) : []),
      ...(d.buttons.length ? sec('Buttons', h('div', { class: 'row' }, d.buttons.map((b) => h('span', { class: 'btn-sample', style: {
        background: b.cs.background, color: b.cs.color, borderRadius: b.cs.radius, padding: b.cs.padding, fontFamily: b.cs.family,
        fontSize: b.cs.size, fontWeight: b.cs.weight, border: b.cs.border === 'none' ? '0' : b.cs.border,
      }, text: b.text || 'Button' })))) : []),
      ...sec('Tailwind v4 theme', h('pre', { text: d.theme.css() })),
    ];
  }

  // ---------------------------------------------------------------- panel

  const files = () => (kind === 'design' ? ['DESIGN.md', markdown(data)] : ['SKILL.md', skill(data)]);

  function render() {
    panel.setSubtitle(`${data.host} · measured at ${data.viewport}`);
    panel.setActions([
      h('div', { class: 'seg' }, button('Visual', { pressed: view === 'visual', onclick: () => { view = 'visual'; render(); } }),
        button('Markdown', { pressed: view === 'markdown', onclick: () => { view = 'markdown'; render(); } })),
      h('div', { class: 'seg' }, button('DESIGN.md', { pressed: kind === 'design', onclick: () => { kind = 'design'; render(); } }),
        button('SKILL.md', { pressed: kind === 'skill', onclick: () => { kind = 'skill'; render(); }, title: 'For Claude Code, Codex or Cursor: put it in .claude/skills/<name>/SKILL.md' })),
      h('div', { class: 'spacer' }),
      button('', { icon: 'copy', onclick: () => MUI.copy(files()[1], `${files()[0]} copied`), title: 'Copy' }),
      button('', { icon: 'download', onclick: () => MUI.download(files()[0], files()[1], 'text/markdown'), title: 'Download' }),
      button('', { icon: 'refresh', onclick: start, title: 'Measure again' }),
    ]);
    panel.setBody(view === 'visual' ? visual(data) : h('pre', { class: 'tall', text: files()[1] }));
  }

  async function start() {
    panel = panel || MUI.panel({ title: 'Design MD', subtitle: 'Measuring…' });
    panel.setBody(h('div', { class: 'empty', text: 'Measuring the page…' }));
    data = await collect();
    if (panel) render();
  }

  MUI.tools.design = { label: 'Design MD', icon: 'design', title: 'Design system of this page as Markdown', start,
    stop: () => { panel = null; } };
})();
