// Colors: every colour the page renders (text, backgrounds, borders, SVG fills), most used first, filterable
// by role. Click a colour to outline where it's used; export as CSS variables, a Tailwind @theme or JSON.
// The eyedropper adds any on-screen colour to "Picked".
(() => {
  const { h, button } = MUI;
  let panel = null;
  let colors = [];
  let picked = [];
  let filter = 'all';

  const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const chroma = (hex) => { const c = rgbOf(hex); return Math.max(...c) - Math.min(...c); };
  const light = (hex) => { const [r, g, b] = rgbOf(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };

  function scan() {
    colors = MUI.scanColors();
  }

  const roleOf = (c) => ({
    all: true, background: c.roles.has('background'), text: c.roles.has('text') || c.roles.has('svg'),
    border: c.roles.has('border'), accent: chroma(c.hex) >= 24, picked: c.roles.has('picked'),
  });

  // Named like Pick's theme tokens (ink, paper, tone-NN, accent…), so exports line up with cloned components.
  function theme() {
    const t = new MirrorUICompile.Theme();
    for (const c of colors.concat(picked)) if (c.hex.length === 7) t.colors.set(c.hex, (t.colors.get(c.hex) || 0) + Math.max(c.count, 1));
    t.finalize();
    return t;
  }
  const exportCss = () => `:root {\n${[...theme().names].map(([hex, n]) => `  --color-${n}: ${hex};`).join('\n')}\n}`;
  const exportTheme = () => theme().css();
  const exportJson = () => {
    const names = theme().names;
    return JSON.stringify(colors.concat(picked).map((c) => ({
      hex: c.hex, name: names.get(c.hex) || null, count: c.count, roles: [...c.roles],
    })), null, 2);
  };

  async function eyedropper() {
    if (!('EyeDropper' in window)) { MUI.toast('This browser has no eyedropper'); return; }
    try {
      const { sRGBHex } = await new EyeDropper().open();
      const hex = sRGBHex.toLowerCase();
      if (!picked.some((c) => c.hex === hex)) picked.unshift({ hex, count: 0, roles: new Set(['picked']), els: [] });
      filter = 'picked';
      render();
    } catch { /* cancelled */ }
  }

  function render() {
    const all = picked.concat(colors);
    const counts = Object.fromEntries(['all', 'background', 'text', 'border', 'accent', 'picked']
      .map((k) => [k, all.filter((c) => roleOf(c)[k]).length]));
    const list = all.filter((c) => roleOf(c)[filter]);
    panel.setSubtitle(`${colors.length} colours in use`);
    panel.setActions([
      button('CSS', { icon: 'copy', onclick: () => MUI.copy(exportCss(), 'CSS variables copied') }),
      button('@theme', { icon: 'copy', onclick: () => MUI.copy(exportTheme(), 'Tailwind @theme copied'), title: 'Tailwind v4 theme tokens' }),
      button('JSON', { icon: 'copy', onclick: () => MUI.copy(exportJson(), 'JSON copied') }),
      h('div', { class: 'spacer' }),
      button('Pick', { icon: 'eyedropper', onclick: eyedropper, title: 'Pick any colour on screen' }),
      button('', { icon: 'refresh', onclick: () => { scan(); render(); }, title: 'Scan again' }),
    ]);
    const tabs = h('div', { class: 'seg', style: { marginBottom: '12px' } }, Object.entries({
      all: 'All', background: 'Background', text: 'Text', border: 'Border', accent: 'Accent', picked: 'Picked',
    }).map(([k, label]) => button(`${label} ${counts[k]}`, { pressed: k === filter, onclick: () => { filter = k; render(); } })));
    const rows = list.map((c) => {
      const fg = light(c.hex.slice(0, 7)) > 0.6 ? '#111' : '#fff';
      const copyBtn = h('button', { title: 'Copy hex', onclick: (e) => { e.stopPropagation(); MUI.copy(c.hex, `${c.hex} copied`); } }, MUI.icon('copy'));
      return h('div', {
        class: 'color', style: { background: c.hex, color: fg },
        title: c.els.length ? 'Click to show where it is used' : '',
        onclick: () => c.els.length && MUI.flash(c.els),
      }, h('span', { text: c.hex }), h('span', { class: 'cnt', text: c.count ? `${c.count}` : 'picked' }), copyBtn);
    });
    panel.setBody([tabs, rows.length ? rows : h('div', { class: 'empty', text: filter === 'picked'
      ? 'Use Pick to sample any colour on screen.' : 'No colours here.' })]);
  }

  function start() {
    panel = MUI.panel({ title: 'Colors', subtitle: 'Scanning…' });
    scan();
    render();
  }

  MUI.tools.colors = { label: 'Colors', icon: 'colors', title: 'Colours used on this page', start, stop: () => { panel = null; } };
})();
