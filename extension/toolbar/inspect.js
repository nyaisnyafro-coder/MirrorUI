// Inspect: hover shows size, font, colour and spacing (padding tinted); click opens the inspector with the
// box model and grouped computed styles, copyable as CSS or converted to Tailwind classes with the same
// extract/compile code Pick uses. Alt + hover measures the distance to the selected element.
(() => {
  const { h, button } = MUI;
  let stopSelect = null;
  let panel = null;
  let selected = null;

  const num = (v) => parseFloat(v) || 0;
  const r1 = (n) => Math.round(n * 10) / 10;
  const SIDES = ['top', 'right', 'bottom', 'left'];
  const sides = (cs, prop) => SIDES.map((s) => num(cs.getPropertyValue(prop === 'border' ? `border-${s}-width` : `${prop}-${s}`)));
  const short = ([t, r, b, l]) => (t === r && r === b && b === l ? `${r1(t)}` : t === b && r === l ? `${r1(t)} ${r1(r)}`
    : `${r1(t)} ${r1(r)} ${r1(b)} ${r1(l)}`);
  const primaryFont = (cs) => cs.fontFamily.split(',')[0].trim().replace(/^["']+|["']+$/g, '');
  const swatch = (color) => h('span', {}, h('span', { class: 'sw', style: { background: color } }), MUI.hex(color) || color);

  // ---------------------------------------------------------------- hover

  function padBands(el, cs, r) {
    const [pt, pr, pb, pl] = sides(cs, 'padding');
    const [bt, br, bb, bl] = sides(cs, 'border');
    const x0 = r.left + bl, y0 = r.top + bt, x1 = r.right - br, y1 = r.bottom - bb;
    const bands = {
      t: { left: x0, top: y0, width: x1 - x0, height: pt },
      b: { left: x0, top: y1 - pb, width: x1 - x0, height: pb },
      l: { left: x0, top: y0 + pt, width: pl, height: y1 - y0 - pt - pb },
      r: { left: x1 - pr, top: y0 + pt, width: pr, height: y1 - y0 - pt - pb },
    };
    for (const [k, rect] of Object.entries(bands)) {
      if (rect.width > 0 && rect.height > 0) MUI.placeBox(`pad-${k}`, rect, 'pad');
      else MUI.hideBox(`pad-${k}`);
    }
  }

  // Alt + hover: gaps between the selected element (a) and the hovered one (b). Insets (distances from one
  // edge to the other inside) only along an axis where the boxes overlap on the other axis, i.e. when one
  // sits inside the other; for boxes stacked apart they'd just be noise.
  function measure(a, b) {
    MUI.clearBoxes('g-');
    const guides = [];
    const overlapX = a.right > b.left && b.right > a.left;
    const overlapY = a.bottom > b.top && b.bottom > a.top;
    const yAt = overlapY ? (Math.max(a.top, b.top) + Math.min(a.bottom, b.bottom)) / 2 : (a.top + a.bottom) / 2;
    const xAt = overlapX ? (Math.max(a.left, b.left) + Math.min(a.right, b.right)) / 2 : (a.left + a.right) / 2;
    const inset = (lo1, hi1, lo2, hi2) => {
      const [outLo, outHi, inLo, inHi] = lo2 >= lo1 && hi2 <= hi1 ? [lo1, hi1, lo2, hi2] : [lo2, hi2, lo1, hi1];
      return [[outLo, inLo], [inHi, outHi]];
    };
    if (b.left >= a.right) guides.push(['h', a.right, b.left, yAt]);
    else if (a.left >= b.right) guides.push(['h', b.right, a.left, yAt]);
    else if (overlapY) guides.push(...inset(a.left, a.right, b.left, b.right).map(([f, t]) => ['h', f, t, yAt]));
    if (b.top >= a.bottom) guides.push(['v', a.bottom, b.top, xAt]);
    else if (a.top >= b.bottom) guides.push(['v', b.bottom, a.top, xAt]);
    else if (overlapX) guides.push(...inset(a.top, a.bottom, b.top, b.bottom).map(([f, t]) => ['v', f, t, xAt]));
    guides.forEach(([dir, from, to, at], i) => {
      const len = to - from;
      if (len < 0.5) return;
      if (dir === 'h') {
        MUI.placeBox(`g-line-${i}`, { left: from, top: at, width: len, height: 1 }, 'guide');
        MUI.placeLabel(`g-label-${i}`, `${r1(len)}`, from + len / 2, at - 10);
      } else {
        MUI.placeBox(`g-line-${i}`, { left: at, top: from, width: 1, height: len }, 'guide');
        MUI.placeLabel(`g-label-${i}`, `${r1(len)}`, at + 18, from + len / 2);
      }
    });
    MUI.placeBox('g-other', b, 'other');
  }

  function onHover(el, e) {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (e && e.altKey && selected && selected !== el && selected.isConnected) {
      MUI.hideBox('hover');
      measure(selected.getBoundingClientRect(), r);
      MUI.hideTip();
      return;
    }
    MUI.clearBoxes('g-');
    padBands(el, cs, r);
    const flexy = /flex|grid/.test(cs.display) && cs.gap !== 'normal' && cs.gap !== '0px';
    MUI.tip([
      h('div', {}, h('b', { text: MUI.describe(el) }), ' ', h('span', { class: 'acc', text: `${r1(r.width)} × ${r1(r.height)}` })),
      h('div', {}, `${primaryFont(cs)} · ${r1(num(cs.fontSize))}px · ${cs.fontWeight}   `, swatch(cs.color)),
      h('div', { class: 'dim', text: `padding ${short(sides(cs, 'padding'))} · margin ${short(sides(cs, 'margin'))}` }),
      flexy ? h('div', { class: 'dim', text: `${cs.display} · gap ${cs.gap}` }) : null,
      h('div', { class: 'dim', text: selected ? 'Click to inspect · Alt + hover to measure' : 'Click to inspect' }),
    ], r);
  }

  // ---------------------------------------------------------------- inspector

  const PROPS = {
    Layout: ['display', 'position', 'width', 'height', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items',
      'gap', 'grid-template-columns', 'z-index', 'overflow'],
    Typography: ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color', 'text-align',
      'text-transform', 'text-decoration-line'],
    Appearance: ['background-color', 'background-image', 'border-top', 'border-right', 'border-bottom', 'border-left',
      'border-radius', 'box-shadow', 'opacity'],
  };
  const BORING = new Set(['none', 'normal', 'auto', 'static', 'visible', 'rgba(0, 0, 0, 0)', 'nowrap', 'row', 'start',
    'left', '1', '0px', 'stretch']);
  const isColor = (p) => p === 'color' || p.endsWith('-color');
  const shown = (p, v, cs) => {
    if (['display', 'width', 'height', 'font-family', 'font-size', 'font-weight', 'line-height', 'color'].includes(p)) return true;
    if (p.startsWith('border-') && p !== 'border-radius') return !v.startsWith('0px');
    if (['flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'gap'].includes(p)) return /flex|grid/.test(cs.display) && !BORING.has(v);
    if (p === 'grid-template-columns') return /grid/.test(cs.display);
    return !BORING.has(v);
  };

  function cssText(el) {
    const cs = getComputedStyle(el);
    const lines = Object.values(PROPS).flat().filter((p) => shown(p, cs.getPropertyValue(p), cs))
      .map((p) => `  ${p}: ${cs.getPropertyValue(p)};`);
    return `${MUI.describe(el)} {\n${lines.join('\n')}\n}`;
  }

  // Same pipeline as Pick, for this element at the current width only.
  function tailwindFor(el) {
    el.setAttribute('data-mui-inspect', '');
    try {
      const capture = MirrorUIExtract.extract('[data-mui-inspect]');
      if (capture.error) throw new Error(capture.error);
      const built = MirrorUICompile.build([capture]);
      return { classes: (/^<[a-z0-9-]+ class="([^"]*)"/i.exec(built.fragment) || [])[1] || '', html: built.fragment };
    } finally {
      MirrorUIExtract.cleanup();
      el.removeAttribute('data-mui-inspect');
    }
  }

  function boxModel(cs, r) {
    const m = sides(cs, 'margin'), b = sides(cs, 'border'), p = sides(cs, 'padding');
    const edge = (label, v) => h('div', { class: 't' }, h('span', { text: label }), h('span', { text: short(v) }));
    const cw = r.width - b[1] - b[3] - p[1] - p[3], ch = r.height - b[0] - b[2] - p[0] - p[2];
    return h('div', { class: 'boxmodel' },
      h('div', { class: 'm' }, edge('margin', m),
        h('div', { class: 'p' }, edge(`border ${short(b)} · padding`, p),
          h('div', { class: 'c', text: `${r1(cw)} × ${r1(ch)}` }))));
  }

  function inspect(el) {
    selected = el;
    MUI.trackBox('selected', el, 'selected');
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const twSlot = h('div');
    const runTailwind = () => {
      const count = el.querySelectorAll('*').length;
      twSlot.replaceChildren(h('p', { class: 'muted small', text: count > 400 ? `Reading ${count} elements…` : 'Reading…' }));
      setTimeout(() => {
        let tw;
        try { tw = tailwindFor(el); } catch (e) { twSlot.replaceChildren(h('div', { class: 'error', text: String(e.message || e) })); return; }
        twSlot.replaceChildren(
          h('div', { class: 'section', text: 'Tailwind (this width)' }),
          h('pre', { text: tw.classes || '(no classes needed)' }),
          h('div', { class: 'row', style: { marginTop: '8px' } },
            button('Copy classes', { icon: 'copy', onclick: () => MUI.copy(tw.classes) }),
            button('Copy as HTML', { icon: 'copy', onclick: () => MUI.copy(tw.html), title: 'The element and its children as Tailwind HTML' })));
      }, 30);
    };
    const groups = Object.entries(PROPS).map(([name, props]) => {
      const rows = props.map((p) => [p, cs.getPropertyValue(p)]).filter(([p, v]) => shown(p, v, cs));
      if (!rows.length) return null;
      return [h('div', { class: 'section', text: name }),
        h('dl', { class: 'props' }, rows.map(([p, v]) => [h('dt', { text: p }), h('dd', {}, isColor(p) ? swatch(v) : v)]))];
    });
    if (!panel) panel = MUI.panel({ title: 'Inspector' });
    panel.setSubtitle(`${MUI.describe(el)} · ${r1(r.width)} × ${r1(r.height)}`);
    panel.setActions([
      button('Parent', { icon: 'up', onclick: () => el.parentElement && el.parentElement !== document.documentElement && inspect(el.parentElement) }),
      button('Copy CSS', { icon: 'copy', onclick: () => MUI.copy(cssText(el)) }),
      button('Tailwind', { primary: true, onclick: runTailwind, title: 'Convert this element to Tailwind classes' }),
    ]);
    panel.setBody([h('div', { class: 'section', text: 'Box' }), boxModel(cs, r), twSlot, groups]);
  }

  function start() {
    selected = null;
    panel = MUI.panel({
      title: 'Inspector',
      subtitle: 'Hover to inspect · click to select',
      body: h('div', { class: 'empty' },
        h('p', { text: 'Hover any element to see its size, font, colour and spacing.' }),
        h('p', { text: 'Click to open its styles here. With one selected, hold Alt and hover another to measure the distance.' })),
    });
    stopSelect = MUI.select({
      hint: 'Hover to inspect · click to select · Alt + hover to measure · Esc done',
      onHover,
      onLeave: () => MUI.clearBoxes('pad-'),
      onPick: inspect,
      onEscape: () => MUI.activate(null),
    });
  }

  function stop() {
    stopSelect?.();
    stopSelect = null;
    selected = null;
    panel = null;
  }

  MUI.tools.inspect = { label: 'Inspect', icon: 'inspect', title: 'Inspect and measure elements', start, stop };
})();
