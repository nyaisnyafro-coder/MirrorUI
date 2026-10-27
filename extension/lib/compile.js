// Captures (one extract.js result per viewport) -> responsive Tailwind v4 HTML + Astro component.
// Classic script, no dependencies: loaded by the browser extension and by the Python CLI (via Playwright),
// so both produce identical output. Exposes globalThis.MirrorUICompile.build(captures, options).
(() => {
  // ---------------------------------------------------------------- helpers

  // Python's round(): halves go to the even neighbour. Kept so class names stay stable across versions.
  const pyRound = (x) => (Math.abs(x % 1) === 0.5 ? 2 * Math.round(x / 2) : Math.round(x));

  const px = (v) => {
    const m = /^(-?[\d.]+(?:e[+-]?\d+)?)px$/i.exec((v || '').trim()); // (huge radii come as 3.35544e+07px)
    return m ? parseFloat(m[1]) : null;
  };

  // Up to 6 decimals: Chrome lays out in 1/64 px and truncates, so 173.8125 written as 173.812 lands on
  // 173.797, and such errors add up down a page until text snaps to the next pixel row.
  // Computed styles round to 4 decimals (29.3281px for the 29.328125 laid out): back onto the 1/64 grid.
  const num = (x) => {
    if (Math.abs(x * 64 - Math.round(x * 64)) < 0.02) x = Math.round(x * 64) / 64;
    let s = (Math.round(x * 1e6) / 1e6).toFixed(6);
    s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s === '-0' || s === '' ? '0' : s;
  };

  // Arbitrary-value body: Tailwind reads underscores as spaces, so real ones (file names in url()) are escaped
  // first; double quotes become single ones, since the class sits inside class="…".
  const arb = (v) => v.trim().replace(/(\d+\.\d+)px/g, (m, d) => `${num(+d)}px`).replace(/"/g, "'").replace(/_/g, '\\_').replace(/,\s+/g, ',').replace(/ /g, '_');

  // px -> spacing-scale suffix ('4', '2.5', 'px', '[13px]', '-4'). null if not a px length.
  const space = (v) => {
    const p = px(v);
    if (p === null) return null;
    const neg = p < 0, a = Math.abs(p);
    // a scale step only when it is the value: rounding to the nearest step shifted things by fractions of a pixel
    if (a < 0.05) return '0';
    let s;
    if (Math.abs(a - 1) < 0.05) s = 'px';
    else {
      const q = pyRound(a / 2) * 2; // spacing scale moves in 0.5 steps = 2px
      s = q && Math.abs(q - a) <= 0.05 ? num(q / 4) : `[${num(a)}px]`;
    }
    return (neg ? '-' : '') + s;
  };

  const cls = (prefix, suffix) => (suffix.startsWith('-') ? `-${prefix}-${suffix.slice(1)}` : `${prefix}-${suffix}`);
  const near = (a, b, tol = 0.5) => a !== null && a !== undefined && Math.abs(a - b) <= tol;
  const words = (s) => s.split(/\s+/).filter(Boolean);
  const unique = (xs) => [...new Set(xs)];
  const hex2 = (n) => n.toString(16).padStart(2, '0');

  const escHtml = (s, quote) => {
    s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return quote ? s.replace(/"/g, '&quot;').replace(/'/g, '&#x27;') : s;
  };

  const parseRgb = (v) => {
    const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/.exec(v.trim());
    if (!m) return null;
    return [pyRound(+m[1]), pyRound(+m[2]), pyRound(+m[3]), m[4] !== undefined ? +m[4] : 1];
  };
  const hexOf = (c) => '#' + c.slice(0, 3).map(hex2).join('');

  // ---------------------------------------------------------------- Tailwind scales

  const FONT_SIZES = [[12, 'xs'], [14, 'sm'], [16, 'base'], [18, 'lg'], [20, 'xl'], [24, '2xl'], [30, '3xl'],
    [36, '4xl'], [48, '5xl'], [60, '6xl'], [72, '7xl'], [96, '8xl'], [128, '9xl']];
  const LEADING = [[1.0, 'none'], [1.25, 'tight'], [1.375, 'snug'], [1.5, 'normal'], [1.625, 'relaxed'], [2.0, 'loose']];
  const TRACKING = [[-0.05, 'tighter'], [-0.025, 'tight'], [0.0, 'normal'], [0.025, 'wide'], [0.05, 'wider'], [0.1, 'widest']];
  const WEIGHTS = { 100: 'thin', 200: 'extralight', 300: 'light', 400: 'normal', 500: 'medium', 600: 'semibold',
    700: 'bold', 800: 'extrabold', 900: 'black' };
  const RADII = { 0: 'none', 2: 'xs', 4: 'sm', 6: 'md', 8: 'lg', 12: 'xl', 16: '2xl', 24: '3xl', 32: '4xl' };
  const MAX_W = { 256: '3xs', 288: '2xs', 320: 'xs', 384: 'sm', 448: 'md', 512: 'lg', 576: 'xl', 672: '2xl',
    768: '3xl', 896: '4xl', 1024: '5xl', 1152: '6xl', 1280: '7xl' };
  const FRACTIONS = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5], [1, 6], [5, 6]];
  const DISPLAY = { none: 'hidden', block: 'block', inline: 'inline', 'inline-block': 'inline-block', flex: 'flex',
    'inline-flex': 'inline-flex', grid: 'grid', 'inline-grid': 'inline-grid', contents: 'contents',
    'flow-root': 'flow-root', 'list-item': 'list-item', table: 'table', 'table-row': 'table-row',
    'table-cell': 'table-cell' };
  const JUSTIFY = { normal: 'normal', 'flex-start': 'start', start: 'start', left: 'start', center: 'center',
    'flex-end': 'end', end: 'end', right: 'end', 'space-between': 'between', 'space-around': 'around',
    'space-evenly': 'evenly', stretch: 'stretch' };
  const ALIGN = { normal: 'stretch', stretch: 'stretch', center: 'center', 'flex-start': 'start', start: 'start',
    'self-start': 'start', 'flex-end': 'end', end: 'end', 'self-end': 'end', baseline: 'baseline' };
  const TEXT_ALIGN = { start: 'left', left: 'left', center: 'center', right: 'right', end: 'right', justify: 'justify' };
  const COLOR_PROPS = ['color', 'background-color', 'border-top-color', 'border-right-color',
    'border-bottom-color', 'border-left-color'];
  const TRBL = [['t', 'top'], ['r', 'right'], ['b', 'bottom'], ['l', 'left']];

  // ---------------------------------------------------------------- theme tokens

  class Theme {
    constructor() {
      this.colors = new Map(); // hex -> count
      this.fonts = new Map();  // slug -> family stack
      this.names = new Map();  // hex -> token name
    }

    addColor(v) {
      const c = parseRgb(v);
      if (c && c[3] > 0) this.colors.set(hexOf(c), (this.colors.get(hexOf(c)) || 0) + 1);
    }

    finalize() {
      const used = new Set();
      let accent = 0;
      for (const [h] of [...this.colors].sort((a, b) => b[1] - a[1])) {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
        const hi = Math.max(r, g, b), lo = Math.min(r, g, b);
        const light = pyRound(((hi + lo) / 2 / 255) * 100);
        let name;
        if (hi - lo < 24) { // cool/warm grays like Bootstrap's #6c757d still count as neutral
          name = light < 8 && !used.has('ink') ? 'ink' : light > 97 && !used.has('paper') ? 'paper' : `tone-${light}`;
        } else {
          accent += 1;
          name = accent === 1 ? 'accent' : `accent-${accent}`;
        }
        const base = name;
        for (let i = 2; used.has(name); i++) name = `${base}-${i}`;
        used.add(name);
        this.names.set(h, name);
      }
    }

    color(prefix, v) {
      const c = parseRgb(v);
      if (c === null) return `${prefix}-[${arb(v)}]`;
      if (c[3] === 0) return `${prefix}-transparent`;
      const name = this.names.get(hexOf(c)) || `[${hexOf(c)}]`;
      const alpha = c[3] >= 1 ? '' : `/${num(c[3] * 100)}`;
      return `${prefix}-${name}${alpha}`;
    }

    // One token per primary family; the longest fallback stack seen wins.
    font(family) {
      const first = family.split(',')[0].trim().replace(/^["']+|["']+$/g, '');
      let slug = first.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'font';
      if (['sans', 'serif', 'mono'].includes(slug)) slug += '-face';
      if (family.length > (this.fonts.get(slug) || '').length) this.fonts.set(slug, family);
      return `font-${slug}`;
    }

    css() {
      const lines = [...this.names].map(([h, n]) => `  --color-${n}: ${h};`)
        .concat([...this.fonts].map(([slug, fam]) => `  --font-${slug}: ${fam};`));
      return '@theme {\n' + lines.join('\n') + '\n}';
    }
  }

  // ---------------------------------------------------------------- one node, one viewport

  // Output runs under border-box; grow content-box lengths by padding + border.
  const borderBox = (s, value, axis) => {
    const p = px(value);
    if (p === null || s['box-sizing'] !== 'content-box') return value;
    const sides = axis === 'x' ? ['left', 'right'] : ['top', 'bottom'];
    const extra = sides.reduce((t, d) => t + px(s[`padding-${d}`]) + px(s[`border-${d}-width`]), 0);
    return `${p + extra}px`;
  };

  // h-screen / min-h-screen, or, for previews, the captured viewport height in px: a preview iframe is sized
  // to its content, so 100vh there is the content's height, which then grows with it, round and round.
  let screenAsPx = false;
  let traceWidth = 0;
  const screenClass = (prefix, vh) => (screenAsPx ? `${prefix}-[${num(vh)}px]` : `${prefix}-screen`);

  const sizeClass = (prefix, value, parentSize, vh, allowScreen) => {
    const p = px(value);
    if (p === null) return ['auto', 'none'].includes(value) ? `${prefix}-${value}` : `${prefix}-[${arb(value)}]`;
    if (parentSize && parentSize > 0) {
      const ratio = p / parentSize;
      // a fraction only when it lands on the value (to 0.1px): a 176px sidebar in 295px is not 3/5 (177px)
      if (Math.abs(p - parentSize) <= 0.1) return `${prefix}-full`;
      for (const [a, b] of FRACTIONS) if (Math.abs(p - (parentSize * a) / b) <= 0.1) return `${prefix}-${a}/${b}`;
      // nearly the full width minus a gutter, e.g. width: calc(100% - 40px): keeps it fluid between breakpoints
      const gap = parentSize - p;
      if (prefix === 'w' && gap >= 4 && gap <= 64 && ratio > 0.75) return `w-[calc(100%_-_${num(gap)}px)]`;
    }
    if (allowScreen && near(p, vh, 1)) return screenClass(prefix, vh);
    return cls(prefix, space(value));
  };

  // grid-column / grid-row placement: col-span-2, col-span-full, col-start-2 col-end-4, else arbitrary
  const gridPlace = (prefix, axis, start, end) => {
    const span = (v) => /^span (\d+)$/.exec(v || '');
    const line = (v) => /^-?\d+$/.test(v || '');
    if (start === 'auto' && end === 'auto') return `${prefix}-auto`;
    if (start === '1' && end === '-1') return `${prefix}-span-full`;
    if (start === 'auto' && span(end)) return `${prefix}-span-${span(end)[1]}`;
    if (end === 'auto' && span(start)) return `${prefix}-span-${span(start)[1]}`;
    const one = (side, v) => (v === 'auto' ? null
      : line(v) ? cls(`${prefix}-${side}`, v) : `[grid-${axis}-${side}:${arb(v)}]`);
    return [one('start', start), one('end', end)].filter(Boolean).join(' ') || `${prefix}-auto`;
  };

  // Computed shadows read "rgba(0, 0, 0, 0.1) 0px 1px 3px 0px inset"; Tailwind only recognises an arbitrary
  // shadow written the usual way round ("inset 0px 1px 3px 0px rgba(…)") and silently drops the other.
  const shadowValue = (v) => v.split(/,(?![^(]*\))/).map((one) => {
    const color = /^\s*((?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)|#[\da-f]+|[a-z]+(?=\s))/i.exec(one);
    let rest = color ? one.slice(color[0].length) : one;
    const inset = /\binset\b/.test(rest);
    rest = rest.replace(/\binset\b/, '').trim();
    return [inset ? 'inset' : '', rest, color ? color[1] : ''].filter(Boolean).join(' ');
  }).join(', ');

  // A translation by half or all of the element's own size is the centring idiom (-translate-x-1/2); other
  // translations map to the spacing scale.
  const translateAxis = (t, size, name) => {
    if (Math.abs(t) < 0.05) return null;
    for (const [k, f] of [['1/2', 0.5], ['full', 1]]) {
      if (near(t, -size * f, 0.1)) return `-${name}-${k}`;
      if (near(t, size * f, 0.1)) return `${name}-${k}`;
    }
    return cls(name, space(`${t}px`));
  };
  // scale-105, scale-[1.025]; rotate-3, -rotate-45, rotate-[7.5deg]
  const scaleClass = (sx, sy) => {
    const one = (v) => (Number.isInteger(Math.round(v * 1e4) / 100) ? String(Math.round(v * 100)) : `[${num(v)}]`);
    if (near(sx, 1, 1e-3) && near(sy, 1, 1e-3)) return null;
    return near(sx, sy, 1e-3) ? `scale-${one(sx)}` : `scale-x-${one(sx)} scale-y-${one(sy)}`;
  };
  const rotateClass = (deg) => {
    const r = Math.round(deg * 100) / 100;
    if (Math.abs(r) < 0.01) return null;
    return Number.isInteger(r) ? cls('rotate', String(r)) : `rotate-[${num(r)}deg]`;
  };

  // Computed transforms come as matrix(a, b, c, d, tx, ty) in px. Without skew it splits into translate,
  // rotate and scale, which is also the order Tailwind's own translate/rotate/scale utilities apply in;
  // anything else stays an arbitrary transform.
  const transformClass = (v, n) => {
    if (v === 'none') return 'translate-none';
    const m = /^matrix\(([^)]+)\)$/.exec(v);
    const [a, b, c, d, tx, ty] = m ? m[1].split(',').map(parseFloat) : [];
    if (!m || Math.abs(a * c + b * d) > 1e-3 || a * d - b * c <= 0) return `[transform:${arb(v)}]`;
    const sx = Math.hypot(a, b), sy = Math.hypot(c, d);
    return [translateAxis(tx, n.w, 'translate-x'), translateAxis(ty, n.h, 'translate-y'),
      rotateClass(Math.atan2(b, a) * 180 / Math.PI), scaleClass(sx, sy)].filter(Boolean).join(' ') || 'translate-none';
  };

  // The individual transform properties (scale: 1.05, rotate: 3deg, translate: -50% 0), as Tailwind v4 writes them.
  const individualTransform = (prop, v, n) => {
    if (v === 'none') return `${prop}-none`;
    const parts = v.trim().split(/\s+/);
    if (prop === 'scale') {
      const [x, y = x] = parts.map((p) => (p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p)));
      return parts.length <= 2 && !Number.isNaN(x + y) ? scaleClass(x, y) || 'scale-100' : `[scale:${arb(v)}]`;
    }
    if (prop === 'rotate') {
      const m = /^(-?[\d.]+)deg$/.exec(v);
      return m ? rotateClass(+m[1]) || 'rotate-0' : `[rotate:${arb(v)}]`;
    }
    if (parts.length > 2) return `[translate:${arb(v)}]`;
    const axis = (p, size, name) => {
      if (p.endsWith('%')) {
        const f = parseFloat(p) / 100;
        const k = { 0.5: '1/2', 1: 'full' }[Math.abs(f)];
        return f === 0 ? null : k ? cls(name, (f < 0 ? '-' : '') + k) : `${name}-[${p}]`;
      }
      return translateAxis(parseFloat(p), size, name);
    };
    return [axis(parts[0], n.w, 'translate-x'), axis(parts[1] || '0px', n.h, 'translate-y')].filter(Boolean).join(' ') || 'translate-none';
  };

  // Returns [simple, sides] for a single viewport:
  //   simple: key -> [class, isDefault]
  //   sides:  group -> {side: [suffix, isDefault]}   (margin, padding, border width, radius)
  const mapNode = (n, parent, props, vp, theme) => {
    const s = n.s, keep = new Set(n.k);
    const pdisp = n.pd || 'block';
    const out = {}, sides = {};
    if (s.position === 'absolute' && near(n.w, 1, 0.1) && near(n.h, 1, 0.1) && s['overflow-x'] === 'hidden') {
      return [{ 'sr-only': ['sr-only', false] }, {}];
    }
    const put = (key, c, prop) => { out[key] = [c, !keep.has(prop || key)]; };
    const has = (p) => props.has(p);

    // --- layout
    if (has('display')) {
      const d = s.display;
      // children of flex/grid are blockified anyway
      const blockified = d === 'block' && ['flex', 'inline-flex', 'grid', 'inline-grid'].includes(pdisp);
      // Chrome reports a clamped box's display as flow-root; any display class would undo line-clamp's -webkit-box
      const clamped = s['-webkit-line-clamp'] && s['-webkit-line-clamp'] !== 'none';
      out.display = [DISPLAY[d] || `[display:${d}]`, !keep.has('display') || blockified || clamped];
    }
    if (has('position')) put('position', s.position);
    const autoInsets = new Set(n.ia || []);
    // the box insets are measured against: the viewport for fixed, the positioned parent (approximately) for absolute
    const insetBase = (side) => {
      const vertical = side === 'top' || side === 'bottom';
      if (s.position === 'fixed') return vertical ? vp.vch || vp.vh : vp.vcw || vp.vw;
      if (s.position === 'absolute' && parent && parent.s.position !== 'static') return vertical ? parent.h : parent.w;
      return null;
    };
    for (const side of ['top', 'right', 'bottom', 'left']) {
      if (!has(side)) continue;
      const v = s[side];
      const base = insetBase(side), p = px(v);
      const frac = base && p ? FRACTIONS.find(([a, b]) => Math.abs(p / base - a / b) < 0.002) : null;
      // centring with a small correction, e.g. left: calc(50% - 7.5px) for half a scrollbar
      const off = base && p ? p - base / 2 : null;
      if (v === 'auto' || autoInsets.has(side) || s.position === 'static') out[side] = [`${side}-auto`, true];
      else if (s.position === 'relative' && px(v) === 0) out[side] = [`${side}-0`, true];
      else if (frac) put(side, `${side}-${frac[0]}/${frac[1]}`);
      else if (off !== null && Math.abs(off) <= 24) put(side, `${side}-[calc(50%_${off < 0 ? '-' : '+'}_${num(Math.abs(off))}px)]`);
      else if (v.endsWith('%')) {
        const ratio = parseFloat(v) / 100;
        const frac = FRACTIONS.find(([a, b]) => Math.abs(ratio - a / b) < 0.001);
        put(side, cls(side, ratio === 1 ? 'full' : frac ? `${frac[0]}/${frac[1]}` : `[${v}]`));
      } else put(side, cls(side, space(v) || `[${arb(v)}]`));
    }
    if (has('z-index')) put('z-index', s['z-index'] === 'auto' ? 'z-auto' : cls('z', s['z-index']));
    if (has('aspect-ratio')) {
      // computed as "1 / 1", "auto 16 / 9" (replaced elements: the natural ratio wins when there is one) or "auto"
      const v = s['aspect-ratio'], m = /^(auto )?([\d.]+) \/ ([\d.]+)$/.exec(v);
      const ratio = m && `${num(+m[2])}/${num(+m[3])}`;
      put('aspect-ratio', v === 'auto' ? 'aspect-auto' : !m ? `aspect-[${arb(v)}]`
        : m[1] ? `[aspect-ratio:auto_${num(+m[2])}/${num(+m[3])}]`
          : ratio === '1/1' ? 'aspect-square' : ratio === '16/9' ? 'aspect-video' : `aspect-[${ratio}]`);
    }
    if (has('transform')) put('transform', transformClass(s.transform, n));
    for (const p of ['scale', 'rotate', 'translate']) {
      if (has(p) && s[p]) put(p, individualTransform(p, s[p], n));
    }
    if (has('overflow-x') || has('overflow-y')) {
      const x = s['overflow-x'], y = s['overflow-y'];
      out.overflow = [x === y ? `overflow-${x}` : `overflow-x-${x} overflow-y-${y}`,
        !keep.has('overflow-x') && !keep.has('overflow-y')];
    }
    if (has('visibility')) put('visibility', s.visibility === 'hidden' ? 'invisible' : 'visible');

    // --- flex / grid
    if (has('flex-direction')) {
      put('flex-direction', { row: 'flex-row', column: 'flex-col', 'row-reverse': 'flex-row-reverse',
        'column-reverse': 'flex-col-reverse' }[s['flex-direction']]);
    }
    if (has('flex-wrap')) {
      put('flex-wrap', { wrap: 'flex-wrap', nowrap: 'flex-nowrap', 'wrap-reverse': 'flex-wrap-reverse' }[s['flex-wrap']]);
    }
    if (has('justify-content')) put('justify-content', 'justify-' + (JUSTIFY[s['justify-content']] || 'normal'));
    if (has('justify-items')) {
      put('justify-items', 'justify-items-' + (ALIGN[s['justify-items'].replace('legacy', '').trim() || 'normal'] || 'stretch'));
    }
    if (has('align-items')) put('align-items', 'items-' + (ALIGN[s['align-items']] || 'stretch'));
    if (has('align-self')) {
      const v = s['align-self'];
      put('align-self', v === 'auto' ? 'self-auto' : 'self-' + (ALIGN[v] || 'auto'));
    }
    const grow = s['flex-grow'], shrink = s['flex-shrink'], basis = s['flex-basis'];
    if (grow === '1' && shrink === '1' && ['0%', '0px'].includes(basis) && (has('flex-grow') || has('flex-basis'))) {
      out.flex = ['flex-1', !keep.has('flex-grow') && !keep.has('flex-basis')];
    } else {
      if (has('flex-grow')) put('flex-grow', grow === '1' ? 'grow' : `grow-${grow}`);
      if (has('flex-shrink')) put('flex-shrink', shrink === '1' ? 'shrink' : `shrink-${shrink}`);
      if (has('flex-basis')) put('flex-basis', basis === 'auto' ? 'basis-auto' : `basis-[${arb(basis)}]`);
    }
    if (has('order')) put('order', cls('order', s.order));
    if (has('row-gap') || has('column-gap')) {
      const rg = space(s['row-gap']) || '0', cg = space(s['column-gap']) || '0';
      out.gap = [rg === cg ? `gap-${rg}` : `gap-x-${cg} gap-y-${rg}`, !keep.has('row-gap') && !keep.has('column-gap')];
    }
    if (has('grid-template-columns')) {
      // only the explicit columns (see explicitColumns in extract.js)
      const all = s['grid-template-columns'] !== 'none' ? words(s['grid-template-columns']) : [];
      const tracks = n.gx ? all.slice(0, n.gx) : all;
      const v = tracks.join(' ');
      const sizes = tracks.map(px);
      let c;
      const equal = sizes.every((x) => x !== null) && Math.max(...sizes) - Math.min(...sizes) < 1;
      // grid-cols-N is N flexible columns: right only when the tracks fill the box; fixed ones stay fixed
      const filled = sizes.reduce((a, b) => a + b, 0) + (px(s['column-gap']) || 0) * (sizes.length - 1);
      if (!tracks.length) c = 'grid-cols-none';
      else if (equal && Math.abs(filled - n.cw) <= 1) c = `grid-cols-${tracks.length}`;
      else if (equal) c = `grid-cols-[repeat(${tracks.length},${num(sizes[0])}px)]`;
      else c = `grid-cols-[${arb(v)}]`;
      put('grid-template-columns', c);
    }
    for (const [axis, prefix] of [['column', 'col'], ['row', 'row']]) {
      const a = `grid-${axis}-start`, b = `grid-${axis}-end`;
      if (!has(a) && !has(b)) continue;
      out[`${prefix}-place`] = [gridPlace(prefix, axis, s[a], s[b]), !keep.has(a) && !keep.has(b)];
    }

    // --- sizing: width/height only when they actually constrain the box (rect sizes are border-box)
    const vh = vp.vh;
    if (has('width')) {
      // a fixed element's width is relative to the viewport, anything else's to its parent
      // (and not a percentage of a parent that is only as wide as its content: w-full there is circular)
      const widthBase = s.position === 'fixed' ? vp.vcw || vp.vw : parent && !n.pf && parent.cw;
      out.width = n.fw ? ['w-auto', true] : [sizeClass('w', `${n.w}px`, widthBase, vh, false), false];
    }
    if (has('height')) {
      // h-full only means something when the parent's height doesn't come from this child
      const definite = parent && !parent.fh && parent.ch;
      out.height = n.fh ? ['h-auto', true] : [sizeClass('h', `${n.h}px`, definite, vh, true), false];
    }
    const flexItem = ['flex', 'inline-flex', 'grid', 'inline-grid'].includes(pdisp);
    for (const [prop, prefix] of [['min-width', 'min-w'], ['min-height', 'min-h'], ['max-width', 'max-w'], ['max-height', 'max-h']]) {
      if (!has(prop)) continue;
      let v = s[prop];
      if (prefix.startsWith('min') && ['auto', '0px'].includes(v)) {
        // auto is the default for flex/grid items, 0px for everything else
        const boxless = ['contents', 'none'].includes(s.display);
        out[prop] = [`${prefix}-${v === 'auto' ? 'auto' : '0'}`, boxless || (v === 'auto') === flexItem];
        continue;
      }
      v = borderBox(s, v, prefix.endsWith('w') ? 'x' : 'y');
      let c;
      if (v === 'none') c = `${prefix}-none`;
      else if (v === '100%') c = `${prefix}-full`;
      else if (prefix === 'max-w' && px(v) !== null && MAX_W[pyRound(px(v))]) c = `max-w-${MAX_W[pyRound(px(v))]}`;
      else if (px(v) !== null && prefix.endsWith('h') && near(px(v), vh, 1)) c = screenClass(prefix, vh);
      else c = cls(prefix, space(v) || `[${arb(v)}]`);
      put(prop, c);
    }

    // --- box sides
    const sideGroup = (group, fmt, names) => {
      if (Object.values(names).some(has)) {
        sides[group] = Object.fromEntries(Object.entries(names).map(([k, p]) => [k, [fmt(s[p]), !keep.has(p)]]));
      }
    };
    sideGroup('m', (v) => space(v) || '0', Object.fromEntries(TRBL.map(([k, v]) => [k, `margin-${v}`])));
    for (const k of n.ma || '') if (sides.m) sides.m[k] = ['auto', false]; // proven margin:auto
    if (sides.m && parent && parent.cw !== undefined && n.w < parent.cw - 0.5) {
      for (const k of ['l', 'r']) if (sides.m[k][0] === '0') sides.m[k] = ['0!', sides.m[k][1]];
    }
    if (sides.m && !n.ma) {
      const ml = px(s['margin-left']), mr = px(s['margin-right']);
      const constrained = !n.fw || s['max-width'] !== 'none';
      // with zero margins only when it fills its parent: anything narrower would move to the centre
      const fills = parent && parent.cw !== undefined && near(n.w, parent.cw, 0.5);
      if (ml !== null && near(ml, mr) && (ml > 0.5 || (s['max-width'] !== 'none' && fills)) && constrained
          && s.display === 'block' && ['block', 'flow-root', 'list-item'].includes(pdisp)) {
        sides.m.l = ['auto', false];
        sides.m.r = ['auto', false];
      }
    }
    sideGroup('p', (v) => space(v) || '0', Object.fromEntries(TRBL.map(([k, v]) => [k, `padding-${v}`])));

    const bw = (v, style) => {
      const p = px(v);
      if (!p || style === 'none') return '0';
      if (near(p, 1, 0.05)) return '';
      return ['2', '4', '8'].includes(num(p)) ? num(p) : `[${num(p)}px]`;
    };
    const borderNames = Object.fromEntries(TRBL.map(([k, v]) => [k, `border-${v}-width`]));
    // (a color alone counts too: that's what a hover or focus state usually changes)
    if (Object.values(borderNames).some((p) => has(p) || has(p.replace('width', 'style')) || has(p.replace('width', 'color')))) {
      sides.border = Object.fromEntries(Object.entries(borderNames)
        .map(([k, p]) => [k, [bw(s[p], s[p.replace('width', 'style')]), !keep.has(p)]]));
      const visible = Object.keys(borderNames).filter((k) => sides.border[k][0] !== '0');
      if (visible.length) {
        const colors = unique(visible.map((k) => s[borderNames[k].replace('width', 'color')]));
        const styles = unique(visible.map((k) => s[borderNames[k].replace('width', 'style')]));
        if (colors.length === 1) out['border-color'] = [theme.color('border', colors[0]), false];
        if (styles.length === 1 && styles[0] !== 'solid') out['border-style'] = [`border-${styles[0]}`, false];
      }
    }

    const radius = (v) => {
      const p = px(v);
      if ((v.endsWith('%') && parseFloat(v) >= 50) || (p !== null && p >= 500)) return 'full';
      if (p !== null && RADII[pyRound(p)] && near(p, pyRound(p), 0.1)) return RADII[pyRound(p)];
      return `[${arb(v)}]`;
    };
    sideGroup('rounded', radius, { tl: 'border-top-left-radius', tr: 'border-top-right-radius',
      br: 'border-bottom-right-radius', bl: 'border-bottom-left-radius' });

    // --- typography
    if (has('font-family')) put('font-family', theme.font(s['font-family']));
    const fs = px(s['font-size']);
    if (has('font-size')) {
      const hit = FONT_SIZES.find(([k]) => near(fs, k, 0.01));
      put('font-size', hit ? `text-${hit[1]}` : `text-[${num(fs)}px]`);
    }
    if (has('font-weight')) put('font-weight', `font-${WEIGHTS[s['font-weight']] || `[${s['font-weight']}]`}`);
    if (has('font-style')) put('font-style', s['font-style'] === 'italic' ? 'italic' : 'not-italic');
    const pinLeading = has('font-size') && keep.has('font-size');
    if (has('line-height') || pinLeading) {
      // text-* also sets line-height in v4, so pin it whenever we emit a font size
      const lh = px(s['line-height']);
      let c;
      if (lh === null) c = 'leading-[normal]';
      else {
        // Line heights add up line after line, so no half-pixel rounding here: a named ratio or an exact
        // scale step, else the ratio itself when it's a clean number (1.35), else the exact px.
        const ratio = fs ? lh / fs : 0;
        const hit = LEADING.find(([k]) => Math.abs(lh - fs * k) < 0.005);
        const step = Math.round(lh / 4 * 4) / 4; // spacing scale in quarter steps
        const clean = Math.round(ratio * 1000) / 1000;
        if (hit) c = `leading-${hit[1]}`;
        else if (Math.abs(lh - step * 4) < 0.005 && lh >= 1) c = `leading-${num(step)}`;
        else if (fs && Math.abs(lh - fs * clean) < 0.002) c = `leading-[${num(clean)}]`;
        else c = `leading-[${num(lh)}px]`;
      }
      out['line-height'] = [c, !keep.has('line-height') && !pinLeading];
    }
    if (has('letter-spacing')) {
      const ls = s['letter-spacing'];
      let c;
      if (ls === 'normal') c = 'tracking-normal';
      else {
        const em = fs ? (px(ls) || 0) / fs : 0;
        const hit = TRACKING.find(([k]) => Math.abs(em - k) < 0.002);
        c = hit ? `tracking-${hit[1]}` : `tracking-[${num(em)}em]`;
      }
      put('letter-spacing', c);
    }
    if (has('text-align')) put('text-align', 'text-' + (TEXT_ALIGN[s['text-align']] || 'left'));
    if (has('text-transform')) put('text-transform', s['text-transform'] === 'none' ? 'normal-case' : s['text-transform']);
    if (has('text-decoration-line')) {
      const v = s['text-decoration-line'];
      put('text-decoration-line', v === 'none' ? 'no-underline' : words(v)[0]);
    }
    // underline details, only where this element draws a decoration
    if (s['text-decoration-line'] && s['text-decoration-line'] !== 'none') {
      if (has('text-decoration-color') && s['text-decoration-color'] !== s.color) {
        put('text-decoration-color', theme.color('decoration', s['text-decoration-color']));
      }
      if (has('text-decoration-thickness')) {
        const v = s['text-decoration-thickness'], p = px(v);
        put('text-decoration-thickness', v === 'auto' ? 'decoration-auto' : v === 'from-font' ? 'decoration-from-font'
          : p !== null && Number.isInteger(p) ? `decoration-${p}` : `decoration-[${arb(v)}]`);
      }
      if (has('text-decoration-style')) put('text-decoration-style', `decoration-${s['text-decoration-style']}`);
    }
    if (has('text-underline-offset')) {
      const v = s['text-underline-offset'], p = px(v);
      put('text-underline-offset', v === 'auto' ? 'underline-offset-auto'
        : p !== null && Number.isInteger(p) ? `underline-offset-${p}` : `underline-offset-[${arb(v)}]`);
    }
    if (has('white-space')) put('white-space', `whitespace-${s['white-space']}`);
    // line-clamp-N brings its own display:-webkit-box, overflow and box orientation
    if (has('-webkit-line-clamp')) {
      const v = s['-webkit-line-clamp'];
      put('-webkit-line-clamp', v === 'none' ? 'line-clamp-none' : `line-clamp-${v}`);
    }
    if (has('text-overflow')) put('text-overflow', s['text-overflow'] === 'ellipsis' ? 'text-ellipsis' : 'text-clip');
    if (has('list-style-type')) {
      const v = s['list-style-type'];
      put('list-style-type', { none: 'list-none', disc: 'list-disc', decimal: 'list-decimal' }[v] || `list-[${v}]`);
    }
    if (has('color')) put('color', theme.color('text', s.color));
    if (n.ph) out.placeholder = [theme.color('placeholder:text', n.ph), false];

    // --- visual
    if (has('background-color')) put('background-color', theme.color('bg', s['background-color']));
    if (has('background-image')) {
      const v = s['background-image'];
      put('background-image', v === 'none' ? 'bg-none' : `bg-[${arb(v)}]`);
    }
    if (has('background-size')) {
      const v = s['background-size'];
      put('background-size', { cover: 'bg-cover', contain: 'bg-contain', auto: 'bg-auto' }[v] || `bg-size-[${arb(v)}]`);
    }
    if (has('background-position')) {
      const v = s['background-position'];
      put('background-position', { '50% 50%': 'bg-center', 'center center': 'bg-center', '0% 0%': 'bg-top-left' }[v]
        || `bg-position-[${arb(v)}]`);
    }
    if (has('background-repeat')) {
      put('background-repeat', { 'no-repeat': 'bg-no-repeat', repeat: 'bg-repeat', 'repeat-x': 'bg-repeat-x',
        'repeat-y': 'bg-repeat-y' }[s['background-repeat']] || `[background-repeat:${arb(s['background-repeat'])}]`);
    }
    // gradient text: background-clip: text with a transparent fill
    const BOXES = { 'border-box': 'border', 'padding-box': 'padding', 'content-box': 'content' };
    if (has('background-clip')) {
      const v = s['background-clip'];
      put('background-clip', v === 'text' ? 'bg-clip-text' : BOXES[v] ? `bg-clip-${BOXES[v]}` : `[background-clip:${arb(v)}]`);
    }
    if (has('background-origin')) {
      const v = s['background-origin'];
      put('background-origin', BOXES[v] ? `bg-origin-${BOXES[v]}` : `[background-origin:${arb(v)}]`);
    }
    if (has('background-attachment')) {
      const v = s['background-attachment'];
      put('background-attachment', ['fixed', 'local', 'scroll'].includes(v) ? `bg-${v}` : `[background-attachment:${arb(v)}]`);
    }
    if (has('-webkit-text-fill-color') && s['-webkit-text-fill-color'] !== s.color) {
      const v = s['-webkit-text-fill-color'];
      put('-webkit-text-fill-color', `[-webkit-text-fill-color:${v === 'rgba(0, 0, 0, 0)' ? 'transparent' : arb(v)}]`);
    }
    if (has('mix-blend-mode')) put('mix-blend-mode', `mix-blend-${s['mix-blend-mode']}`);
    if (has('filter')) put('filter', s.filter === 'none' ? 'filter-none' : `[filter:${arb(s.filter)}]`);
    if (has('backdrop-filter')) {
      const v = s['backdrop-filter'];
      put('backdrop-filter', v === 'none' ? 'backdrop-filter-none' : `[backdrop-filter:${arb(v)}]`);
    }
    // outlines, only where one is drawn: outline-color follows the text color everywhere else
    if (has('outline-style')) {
      const v = s['outline-style'];
      put('outline-style', v === 'none' ? 'outline-none' : v === 'solid' ? 'outline-solid' : `outline-${v}`);
    }
    if (s['outline-style'] && s['outline-style'] !== 'none') {
      const w = px(s['outline-width']), o = px(s['outline-offset']);
      if (has('outline-width')) put('outline-width', w !== null && Number.isInteger(w) ? `outline-${w}` : `outline-[${arb(s['outline-width'])}]`);
      if (has('outline-color') && s['outline-color'] !== s.color) put('outline-color', theme.color('outline', s['outline-color']));
      if (has('outline-offset')) put('outline-offset', o !== null && Number.isInteger(o) ? cls('outline-offset', String(o)) : `outline-offset-[${arb(s['outline-offset'])}]`);
    }
    if (has('box-shadow')) put('box-shadow', s['box-shadow'] === 'none' ? 'shadow-none' : `shadow-[${arb(shadowValue(s['box-shadow']))}]`);
    if (has('opacity')) {
      const o = parseFloat(s.opacity);
      put('opacity', (o * 100) % 5 === 0 ? `opacity-${num(o * 100)}` : `opacity-[${num(o)}]`);
    }
    if (has('object-fit')) put('object-fit', `object-${s['object-fit']}`);
    if (has('cursor')) put('cursor', `cursor-${s.cursor}`);
    // fill/stroke only matter on SVGs (their children are copied verbatim)
    for (const prop of ['fill', 'stroke']) {
      if (has(prop) && 'svg' in n) {
        const v = s[prop];
        put(prop, v === 'none' ? `${prop}-none` : v.startsWith('rgb') ? theme.color(prop, v) : `${prop}-[${arb(v)}]`);
      }
    }
    if (has('field-sizing')) put('field-sizing', `field-sizing-${s['field-sizing']}`);
    if (has('resize')) {
      put('resize', { none: 'resize-none', both: 'resize', vertical: 'resize-y', horizontal: 'resize-x' }[s.resize] || 'resize');
    }
    for (const [prop, named] of EXTRA) {
      if (!has(prop) || !s[prop]) continue;
      const v = s[prop], c = named ? named(v, s, n) : null;
      if (c !== false) put(prop, c || `[${prop}:${arb(v)}]`); // false: not drawn, leave it out
    }
    // transform-origin is computed in px, so it differs for every box: only where something is transformed and
    // the origin isn't the centre
    const transformed = ['transform', 'rotate', 'scale'].some((p) => s[p] && s[p] !== 'none');
    const [ox, oy] = (s['transform-origin'] || '').split(' ').map(px);
    if (transformed && ox !== null && oy !== undefined && !(near(ox, n.w / 2, 0.5) && near(oy, n.h / 2, 0.5))) {
      put('transform-origin', `origin-[${arb(s['transform-origin'])}]`);
    }
    return [out, sides];
  };

  // More properties: [prop, (value, styles, node) -> Tailwind class, null for [prop:value], false for nothing]
  const EXTRA = [
    ['grid-template-rows', (v) => (v === 'none' ? 'grid-rows-none' : `grid-rows-[${arb(v)}]`)],
    ['grid-template-areas'],
    ['grid-auto-flow', (v) => ({ row: 'grid-flow-row', column: 'grid-flow-col', dense: 'grid-flow-dense',
      'row dense': 'grid-flow-row-dense', 'column dense': 'grid-flow-col-dense' }[v])],
    ['grid-auto-rows', (v) => (v === 'auto' ? 'auto-rows-auto' : `auto-rows-[${arb(v)}]`)],
    ['grid-auto-columns', (v) => (v === 'auto' ? 'auto-cols-auto' : `auto-cols-[${arb(v)}]`)],
    ['align-content', (v) => ({ normal: 'content-normal', center: 'content-center', 'flex-start': 'content-start',
      start: 'content-start', 'flex-end': 'content-end', end: 'content-end', 'space-between': 'content-between',
      'space-around': 'content-around', 'space-evenly': 'content-evenly', stretch: 'content-stretch' }[v])],
    ['justify-self', (v) => ({ auto: 'justify-self-auto', start: 'justify-self-start', end: 'justify-self-end',
      center: 'justify-self-center', stretch: 'justify-self-stretch' }[v])],
    ['vertical-align', (v) => (['baseline', 'top', 'middle', 'bottom', 'text-top', 'text-bottom', 'sub', 'super'].includes(v)
      ? `align-${v}` : null)],
    ['object-position', (v) => ({ '50% 50%': 'object-center', '50% 0%': 'object-top', '50% 100%': 'object-bottom',
      '0% 50%': 'object-left', '100% 50%': 'object-right' }[v])],
    ['isolation', (v) => (v === 'isolate' ? 'isolate' : 'isolation-auto')],
    ['text-wrap-style', (v) => ({ balance: 'text-balance', pretty: 'text-pretty', auto: 'text-wrap' }[v])],
    ['text-shadow', (v) => (v === 'none' ? 'text-shadow-none' : null)],
    ['text-indent'], ['word-spacing'],
    ['word-break', (v) => ({ 'break-all': 'break-all', 'keep-all': 'break-keep', normal: 'break-normal' }[v])],
    ['overflow-wrap', (v) => ({ anywhere: 'wrap-anywhere', 'break-word': 'wrap-break-word', normal: 'wrap-normal' }[v])],
    ['hyphens', (v) => ({ none: 'hyphens-none', manual: 'hyphens-manual', auto: 'hyphens-auto' }[v])],
    ['font-feature-settings'], ['font-variation-settings'],
    ['font-variant-numeric', (v) => ({ 'tabular-nums': 'tabular-nums', 'oldstyle-nums': 'oldstyle-nums',
      'lining-nums': 'lining-nums', 'proportional-nums': 'proportional-nums', normal: 'normal-nums' }[v])],
    ['font-stretch'],
    ['clip-path'], ['mask-image'], ['mask-size'], ['mask-position'], ['mask-repeat'],
    // Chrome reports the -webkit- keywords, which the standard property doesn't take
    ['mask-composite', (v) => `[mask-composite:${v.split(', ').map((k) => ({ 'source-over': 'add', 'destination-over': 'add',
      'source-in': 'intersect', 'destination-in': 'intersect', 'source-out': 'subtract', xor: 'exclude' }[k] || k)).join(',')}]`],
    ['mask-mode'],
    ['mask-origin'], ['mask-clip'],
    ['stroke-width', (v) => (/^\d+px$/.test(v) ? `stroke-${parseInt(v, 10)}` : null)],
    ['list-style-position', (v) => `list-${v}`],
    ['border-collapse', (v) => `border-${v}`],
    ['border-spacing'],
    ['table-layout', (v) => (v === 'fixed' ? 'table-fixed' : 'table-auto')],
    ['column-count', (v) => (v === 'auto' ? 'columns-auto' : /^\d+$/.test(v) ? `columns-${v}` : null)],
    ['writing-mode'], ['-webkit-text-stroke-width'],
    // follows the text colour like the fill colour: only where a stroke is drawn
    ['-webkit-text-stroke-color', (v, s) => (parseFloat(s['-webkit-text-stroke-width']) ? null : false)],
    ['perspective', (v) => (v === 'none' ? 'perspective-none' : null)],
    ['backface-visibility', (v) => `backface-${v}`],
    ['transform-style', (v) => (v === 'preserve-3d' ? 'transform-3d' : v === 'flat' ? 'transform-flat' : null)],
    // computed in px like transform-origin: only with a perspective, and off centre
    ['perspective-origin', (v, s, n) => {
      const [x, y] = v.split(' ').map(px);
      return s.perspective === 'none' || (near(x, n.w / 2, 0.5) && near(y, n.h / 2, 0.5)) ? false : `perspective-origin-[${arb(v)}]`;
    }],
  ];

  const collectColors = (n, props, theme) => {
    const s = n.s;
    for (const p of COLOR_PROPS.concat('svg' in n ? ['fill', 'stroke'] : [])) {
      if (!props.has(p)) continue;
      if (p.startsWith('border') && !px(s[p.replace('color', 'width')])) continue;
      theme.addColor(s[p]);
    }
    if (n.ph) theme.addColor(n.ph);
    if (props.has('outline-color') && s['outline-style'] && s['outline-style'] !== 'none') theme.addColor(s['outline-color']);
    if (props.has('text-decoration-color') && s['text-decoration-line'] && s['text-decoration-line'] !== 'none'
        && s['text-decoration-color'] !== s.color) theme.addColor(s['text-decoration-color']);
  };

  // ---------------------------------------------------------------- merge viewports, build the tree

  const TAILWIND_CDN = 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4.1.11';
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'source', 'track', 'wbr']);
  const BLOCKY = ['block', 'flex', 'grid', 'list-item', 'table', 'flow-root', 'none'];

  // Smallest viewport is the unprefixed base; the rest map to md:, lg:, xl: in order.
  const BP_MIN = { 'md:': '48rem', 'lg:': '64rem', 'xl:': '80rem', '2xl:': '96rem' };
  const breakpoints = (viewports) => [''].concat(['md:', 'lg:', 'xl:', '2xl:'].slice(0, viewports.length - 1));

  const nodeProps = (nodes) => {
    const props = new Set(nodes.flatMap((n) => n.k));
    props.delete('width');
    props.delete('height');
    if (!nodes.every((n) => n.fw)) props.add('width');
    if (!nodes.every((n) => n.fh)) props.add('height');
    return props;
  };

  // Children aligned across viewports: [groups, how many viewports they cover, how]. 'same' children, children
  // 'moved' by a script, the same 'shape' with other content, or 'none' (only the base viewport's).
  const aligned = (nodes) => {
    const kids = nodes.map((n) => n.c || []);
    const same = kids.every((k) => k.length === kids[0].length
      && k.every((b, i) => ('text' in kids[0][i]) === ('text' in b) && kids[0][i].t === b.t));
    // same shape can still be other children in each place (all the slides of a carousel are divs)
    const identical = same && kids.every((k) => k.every((b, i) => signature(b) === signature(kids[0][i])));
    const moved = !identical && reordered(nodes, kids);
    if (moved) return [moved, nodes.length, 'moved'];
    if (same) return [kids[0].map((_, i) => kids.map((k) => k[i])), nodes.length, identical ? 'same' : 'shape'];
    return [kids[0].map((c) => [c]), 1, 'none'];
  };

  // The children to render, as runs of viewports: [{from, to, groups}]. Usually one run over all of them. When a
  // site serves other markup at some widths (a mobile layout of its own), each run of widths with the same
  // children gets its own copy, shown only at those widths (see render).
  const childRuns = (nodes) => {
    const [groups, k, how] = aligned(nodes);
    const one = [{ from: 0, to: k - 1, groups }];
    // only where the children themselves differ (other elements, another number of them); a difference deeper
    // down is handled there, so copies stay as small as they can be
    if (how !== 'none' || nodes.length < 2) return one;
    // only between boxes: copies of inline text would need wrappers
    const forkable = nodes.every((n) => !/^(inline|contents)/.test(n.s.display) && n.s.display !== 'none')
      && nodes.every((n) => (n.c || []).every((c) => !('text' in c) || !c.text.trim()));
    if (!forkable) return one;
    const seq = nodes.map((n) => (n.c || []).filter((c) => !('text' in c)).map((c) => c.t).join(' '));
    const runs = [];
    for (let from = 0, v = 1; v <= nodes.length; v++) {
      if (v === nodes.length || seq[v] !== seq[from]) { runs.push([from, v - 1]); from = v; }
    }
    if (runs.length === 1) return one;
    return runs.map(([from, to]) => ({ from, to, groups: aligned(nodes.slice(from, to + 1))[0] }));
  };

  const DISPLAY_CLASS = { block: 'block', flex: 'flex', grid: 'grid', 'inline-block': 'inline-block',
    'inline-flex': 'inline-flex', 'inline-grid': 'inline-grid', inline: 'inline', table: 'table', 'flow-root': 'flow-root',
    'list-item': 'list-item', contents: 'contents', 'table-row': 'table-row', 'table-cell': 'table-cell' };

  // A copy of children for the widths from..to of `count`: hidden below and above them.
  const onlyAt = (v, from, to, count, display, bps) => {
    if ('text' in v) return v;
    const extra = [];
    if (from > 0) extra.push('hidden', `${bps[from]}${DISPLAY_CLASS[display] || 'block'}`);
    if (to < count - 1) extra.push(`${bps[to + 1]}hidden`);
    if ('raw' in v) {
      const raw = /^<svg[^>]*\sclass="/.test(v.raw) ? v.raw.replace(/^(<svg[^>]*\sclass=")/, `$1${extra.join(' ')} `)
        : v.raw.replace('<svg', `<svg class="${extra.join(' ')}"`);
      return { ...v, raw };
    }
    return { ...v, cls: [v.cls, ...extra].filter(Boolean).join(' ') };
  };

  // What an element shows: tag, text and link targets, to recognise it again at another width.
  const signature = (n) => {
    if ('text' in n) return n.text.trim();
    if (n._sig === undefined) {
      // (not src: responsive images load another file at each width)
      const attrs = (n.a || []).filter(([k]) => k === 'href').map(([, v]) => v).join(' ');
      n._sig = `<${n.t} ${attrs}>${(n.c || []).map(signature).join('')}`;
    }
    return n._sig;
  };

  // A carousel moved by its script: the same children in another order at some widths (Swiper's loop mode
  // re-appends slides). In a flex or grid parent they're paired by what they show, and each one's place at
  // each width is kept as its _ord, which becomes order-N there (see classList).
  const reordered = (nodes, kids) => {
    if (!nodes.every((n) => /flex|grid/.test(n.s.display))) return null;
    const els = kids.map((k) => k.filter((c) => !('text' in c)));
    if (kids.some((k, v) => k.length - els[v].length !== k.filter((c) => 'text' in c && !c.text.trim()).length)) return null;
    if (els.some((e) => e.length !== els[0].length) || els[0].length < 2) return null;
    const groups = els[0].map((c) => [c]);
    for (let v = 1; v < els.length; v++) {
      const free = new Map();
      els[v].forEach((c, pos) => {
        const s = signature(c);
        free.set(s, (free.get(s) || []).concat(pos));
      });
      for (const g of groups) {
        const pos = (free.get(signature(g[0])) || []).shift();
        if (pos === undefined || els[v][pos].t !== g[0].t) return null;
        g.push(els[v][pos]);
      }
    }
    groups.forEach((g, base) => g.forEach((c, v) => { c._ord = v ? els[v].indexOf(c) : base; }));
    return groups;
  };

  // ::before/::after of the same element across viewports; where it's missing it was display:none.
  const pseudoNodes = (nodes, which) => {
    const present = nodes.find((n) => n[which]);
    if (!present) return null;
    const tpl = present[which];
    return nodes.map((n) => n[which] || { ...tpl, s: { ...tpl.s, display: 'none' }, k: tpl.k.concat('display') });
  };

  const collect = (nodes, theme, ctx) => {
    if ('text' in nodes[0]) return;
    const props = nodes[0]._props = nodeProps(nodes);
    for (const n of nodes) collectColors(n, props, theme);
    for (const which of ['pb', 'pa']) {
      const fakes = pseudoNodes(nodes, which);
      if (!fakes) continue;
      const pprops = nodes[0][`_${which}`] = nodeProps(fakes);
      for (const f of fakes) collectColors(f, pprops, theme);
    }
    for (const diff of hoverDiffsFor(nodes[0], ctx).concat(ownStateDiffs(nodes[0], ctx))) {
      for (const p of COLOR_PROPS.concat(['fill', 'stroke', 'outline-color'])) if (p in diff[1]) theme.addColor(diff[1][p]);
    }
    for (const run of childRuns(nodes)) for (const g of run.groups) collect(g, theme, ctx);
  };

  // [[hoveredIndex, {prop: value}], ...] for the element n, from the widest capture's hover pass
  const hoverDiffsFor = (n, ctx) => Object.entries(ctx.hover)
    .filter(([, byNode]) => byNode[n.i])
    .map(([i, byNode]) => [+i, byNode[n.i]]);

  // [[state, {prop: value}], ...]: what :focus, :focus-visible and :active change on n itself. The browser's
  // own focus ring (outline-style: auto) isn't the page's design and stays out.
  const ownStateDiffs = (n, ctx) => Object.entries(ctx.states || {}).flatMap(([state, byEl]) => {
    const diff = { ...(byEl[n.i] || {})[n.i] };
    if (diff['outline-style'] === 'auto') for (const p of Object.keys(diff)) if (p.startsWith('outline')) delete diff[p];
    return Object.keys(diff).length ? [[state, diff]] : [];
  });

  // seq: per-viewport [class, isDefault]. Returns classes with breakpoint prefixes, mobile-first.
  const layered = (seq, bps) => {
    const out = [];
    let state = null;
    seq.forEach(([c, def], i) => {
      const bp = bps[i];
      if (def && c === state) return; // back to the default, but the class already in effect says the same
      const target = def ? null : c;
      if (target !== state) {
        if (bp || target) out.push(...words(c).map((part) => bp + part));
        state = target;
      }
    });
    return out;
  };

  // Collapse margin/padding/border/radius sides into the shortest Tailwind form.
  const sideLayers = (group, merged, bps) => {
    const seq = (...keys) => bps.map((_, i) => [merged[keys[0]][i][0], keys.every((k) => merged[k][i][1])]);
    if (group === 'm') {
      // an auto margin that resolved to 0 at another viewport is still auto there
      for (const [k, sq] of Object.entries(merged)) {
        // ('0!': a zero margin on a box narrower than its parent, where auto would move it; see mapNode)
        merged[k] = sq.some(([v]) => v === 'auto')
          ? sq.map(([v, d]) => (['auto', '0'].includes(v) ? ['auto', false] : v === '0!' ? ['0', false] : [v, d]))
          : sq.map(([v, d]) => (v === '0!' ? ['0', d] : [v, d]));
      }
    }
    const vals = (k) => JSON.stringify(merged[k].map(([v]) => v));
    let parts;
    if (group === 'rounded') {
      parts = new Set(Object.keys(merged).map(vals)).size === 1
        ? [['', seq('tl', 'tr', 'br', 'bl')]] : ['tl', 'tr', 'br', 'bl'].map((k) => [k, seq(k)]);
    } else if (vals('t') === vals('r') && vals('r') === vals('b') && vals('b') === vals('l')) {
      parts = [['', seq('t', 'r', 'b', 'l')]];
    } else {
      parts = vals('l') === vals('r') ? [['x', seq('l', 'r')]] : [['l', seq('l')], ['r', seq('r')]];
      parts = parts.concat(vals('t') === vals('b') ? [['y', seq('t', 'b')]] : [['t', seq('t')], ['b', seq('b')]]);
    }
    const out = [];
    for (const [side, sq] of parts) {
      const make = (v) => {
        if (group === 'm' || group === 'p') return cls(group + side, v);
        const prefix = group + (side ? `-${side}` : '');
        return v === '' ? prefix : `${prefix}-${v}`;
      };
      out.push(...layered(sq.map(([v, d]) => [make(v), d]), bps));
    }
    return out;
  };

  // Per-viewport mapNode results -> classes ordered base, md:, lg:...
  const mergeMaps = (maps, bps) => {
    const keys = unique(maps.flatMap(([simple]) => Object.keys(simple)));
    const byBp = Object.fromEntries(bps.map((bp) => [bp, []]));
    const bucket = (c) => byBp[[...bps].reverse().find((bp) => c.startsWith(bp))].push(c);
    for (const key of keys) {
      const seq = maps.map(([simple]) => simple[key] || [(maps[0][0][key] || ['', true])[0], true]);
      layered(seq, bps).forEach(bucket);
    }
    for (const group of unique(maps.flatMap(([, sides]) => Object.keys(sides)))) {
      if (maps.every(([, sides]) => group in sides)) {
        const merged = Object.fromEntries(Object.keys(maps[0][1][group]).map((k) => [k, maps.map(([, sides]) => sides[group][k])]));
        sideLayers(group, merged, bps).forEach(bucket);
      }
    }
    return bps.flatMap((bp) => byBp[bp]);
  };

  // 'md:absolute' + 'before:' -> 'md:before:absolute' (breakpoint first, then the state/pseudo variant)
  const withVariant = (c, variant, bps) => {
    const bp = ['', ...bps].reverse().find((b) => c.startsWith(b)); // ('' too: a copy for md: and up has no base)
    return bp + variant + c.slice(bp.length);
  };

  // CSS content value -> Tailwind content-[...]; '""' needs nothing (before:/after: already set it).
  const contentClass = (content) => {
    if (content === '""') return null;
    if (/^".*"$/.test(content)) {
      const inner = content.slice(1, -1).replace(/\\"/g, '"')
        .replace(/_/g, '\\_').replace(/ /g, '_').replace(/'/g, "\\'");
      return `content-['${inner}']`;
    }
    return `content-[${arb(content)}]`;
  };

  const TRANSITION_PROPS = { all: 'transition-all', opacity: 'transition-opacity', transform: 'transition-transform',
    'box-shadow': 'transition-shadow', color: 'transition-colors', 'background-color': 'transition-colors',
    'border-color': 'transition-colors' };
  const transitionClasses = (tr) => {
    const props = tr['transition-property'].split(',').map((p) => p.trim());
    if (props.includes('none')) return [];
    const single = props.length === 1 ? TRANSITION_PROPS[props[0]] : null;
    const prop = single || (props.every((p) => TRANSITION_PROPS[p] === 'transition-colors') ? 'transition-colors' : 'transition');
    const d = tr['transition-duration'].split(',')[0].trim();
    const ms = d.endsWith('ms') ? parseFloat(d) : parseFloat(d) * 1000;
    const ease = tr['transition-timing-function'].split(/,(?![^(]*\))/)[0].trim();
    return [prop, `duration-${num(ms)}`, ease === 'linear' ? 'ease-linear' : `ease-[${arb(ease)}]`];
  };

  // Classes for one non-viewport state (hover) of the widest viewport: only what the diff changes.
  const stateClasses = (n, parent, diff, vp, theme) => {
    const fake = { ...n, s: { ...n.s, ...diff }, k: Object.keys(diff), fw: true, fh: true, ph: null };
    const [simple, sides] = mapNode(fake, parent, new Set(Object.keys(diff)), vp, theme);
    const out = Object.values(simple).filter(([, def]) => !def).flatMap(([c]) => words(c));
    for (const [group, byside] of Object.entries(sides)) {
      const merged = Object.fromEntries(Object.entries(byside).map(([k, v]) => [k, [v]]));
      out.push(...sideLayers(group, merged, ['']));
    }
    return out;
  };

  const classList = (nodes, parents, viewports, theme, bps, ctx) => {
    const maps = nodes.map((n, i) => mapNode(n, parents[i], nodes[0]._props, viewports[i], theme));
    if (nodes.some((n) => n.sh)) {
      // root stretched by its original row: keep that height as a minimum (see extract.js)
      maps.forEach(([simple], i) => {
        simple['min-height'] = nodes[i].sh ? [cls('min-h', space(`${nodes[i].sh}px`)), false] : ['min-h-0', true];
      });
    }
    if (nodes.some((n) => n._ord !== undefined)) {
      // its place in a carousel the script reordered (see reordered): the markup has the first width's order
      maps.forEach(([simple], i) => { simple.order = [`order-${nodes[i]._ord}`, i === 0]; });
    }
    const out = mergeMaps(maps, bps);
    for (const [which, variant] of [['pb', 'before:'], ['pa', 'after:']]) {
      const fakes = pseudoNodes(nodes, which);
      if (!fakes) continue;
      const maps = fakes.map((f, i) => mapNode(f, nodes[i], nodes[0][`_${which}`], viewports[i], theme));
      const content = contentClass(fakes[fakes.length - 1].content);
      out.push(...(content ? [content] : []).concat(mergeMaps(maps, bps)).map((c) => withVariant(c, variant, bps)));
    }
    // hover: on the element itself, or on a descendant via the hovered ancestor's group
    const last = nodes.length - 1;
    const diffs = hoverDiffsFor(nodes[0], ctx);
    const named = (i) => (ctx.groupNames ? `/${ctx.groupNames.get(i)}` : '');
    if (ctx.groups.has(nodes[0].i)) out.unshift('group' + named(nodes[0].i));
    for (const [i, diff] of diffs) {
      const variant = i === nodes[0].i ? 'hover:' : `group-hover${named(i)}:`;
      out.push(...stateClasses(nodes[last], parents[last], diff, viewports[last], theme).map((c) => variant + c));
    }
    // focus:, focus-visible:, active: on the element itself
    const own = ownStateDiffs(nodes[0], ctx);
    for (const [state, diff] of own) {
      out.push(...stateClasses(nodes[last], parents[last], diff, viewports[last], theme).map((c) => `${state}:${c}`));
    }
    if ((diffs.length || own.length) && nodes[last].tr) out.push(...transitionClasses(nodes[last].tr));
    return out;
  };

  // ---------------------------------------------------------------- fonts

  const FONT_TYPES = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' };

  // @font-face rules for the families the component actually uses (or the given lowercase family names):
  // [{family, css, urls}]
  const fontFaces = (captures, families = null) => {
    const used = new Set(families || []);
    const visit = (n) => {
      if (!n || 'text' in n) return;
      used.add(n.s['font-family'].split(',')[0].trim().replace(/^["']+|["']+$/g, '').toLowerCase());
      (n.c || []).forEach(visit);
    };
    if (!families) captures.forEach((c) => visit(c.root));
    const blocks = [];
    for (const c of captures) {
      blocks.push(...((c.fonts && c.fonts.faces) || []));
      for (const sheet of c.fontSheets || []) {
        for (const css of sheet.text.match(/@font-face\s*\{[^}]*\}/g) || []) {
          blocks.push(css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g,
            (m, q, u) => (u.startsWith('data:') ? m : `url("${new URL(u, sheet.url).href}")`)));
        }
      }
    }
    const out = [];
    for (const css of unique(blocks)) {
      const fam = /font-family\s*:\s*([^;}]+)/.exec(css);
      const family = fam ? fam[1].trim().replace(/^["']+|["']+$/g, '').toLowerCase() : '';
      if (!used.has(family)) continue;
      const urls = [...css.matchAll(/url\("([^"]+)"\)/g)].map((m) => m[1]).filter((u) => !u.startsWith('data:'));
      out.push({ family, css, urls });
    }
    return out;
  };

  const fontCss = (captures, files) => fontFaces(captures)
    .map((f) => f.css.replace(/url\("([^"]+)"\)/g, (m, u) => (files && files[u] ? `url("${files[u]}")` : m)))
    .join('\n');

  const attrStr = (attrs) => Object.entries(attrs)
    .map(([k, v]) => (v === '' ? ` ${k}` : ` ${k}="${escHtml(v, true)}"`)).join('');

  // Captured nodes (one per viewport) -> output tree shared by the HTML and Astro writers:
  // {text} | {tag, cls, attrs, kids, pretty, hint} | {tag: 'svg', raw, hint}
  const render = (nodes, parents, viewports, theme, bps, ctx) => {
    const base = nodes[0];
    if ('text' in base) return { text: base.text };
    const k = nodes.length;
    const classes = classList(nodes, parents, viewports.slice(0, k), theme, bps.slice(0, k), ctx).join(' ');
    // a cloned <body> (Clone page) becomes a <div>: the output document already has its own body; the
    // component is then named Page
    const tag = base.t === 'body' ? 'div' : base.t, hint = base.t === 'body' ? 'page' : base.cn || '';
    if ('svg' in base) {
      let svg = base.svg.replace(/^<svg([^>]*?)\sclass="[^"]*"/, '<svg$1').replace(/^<svg([^>]*?)\sstyle=""/, '<svg$1');
      if (classes) svg = svg.replace('<svg', `<svg class="${classes}"`);
      return { tag: 'svg', raw: svg, hint };
    }
    if (base.t === 'video') {
      // the captured frame as the poster (the widest capture's)
      const snap = nodes.map((n) => n.snap).filter(Boolean).pop();
      if (snap) base.a = base.a.filter(([k]) => k !== 'poster').concat([['poster', snap]]);
    }
    if (base.t === 'canvas') {
      // a picture of the drawing stands in for the script that drew it; where it differs between widths,
      // each breakpoint gets its own through <picture>
      const snaps = nodes.map((n) => n.snap || null);
      if (snaps.some(Boolean)) {
        const img = { tag: 'img', cls: classes, attrs: { src: snaps[0] || snaps.find(Boolean), alt: '' }, kids: [], pretty: false, hint };
        if (new Set(snaps.filter(Boolean)).size === 1) return img;
        const sources = [];
        snaps.forEach((src, i) => {
          if (i && src && src !== snaps[i - 1]) {
            // hidden: under display:contents a <source> would otherwise be a (flex) item of its own
            sources.unshift({ tag: 'source', cls: 'hidden', kids: [], attrs: { media: `(min-width: ${BP_MIN[bps[i]]})`, srcset: src } });
          }
        });
        return { tag: 'picture', cls: 'contents', attrs: {}, kids: sources.concat(img), pretty: true, hint };
      }
    }
    const runs = childRuns(nodes);
    let kids = runs.flatMap(({ from, to, groups: gs }) => gs.map((g) => {
      const kid = render(g, nodes.slice(from, to + 1), viewports.slice(from), theme, bps.slice(from), ctx);
      return runs.length > 1 ? onlyAt(kid, from, to, nodes.length, g[0].s && g[0].s.display, bps) : kid;
    }));
    const groups = runs.flatMap((r) => r.groups);
    const disp = base.s.display;
    // (inside white-space: pre every space and line break is content: never re-indented)
    const pre = /^pre|break-spaces/.test(base.s['white-space'] || '');
    const pretty = !pre && (disp.includes('flex') || disp.includes('grid')) || !pre && groups.every((g) =>
      ('text' in g[0] ? g[0].text.trim() === '' : BLOCKY.includes(g[0].s.display)));
    if (pretty) kids = kids.filter((kid) => !('text' in kid) || kid.text.trim());
    const attrs = Object.fromEntries(base.a);
    // debugging (options.trace = a capture's viewport width): which captured element each one comes from
    if (traceWidth) {
      const v = viewports.findIndex((vp) => vp.vw === traceWidth);
      if (v >= 0 && nodes[v]) attrs['data-mui-i'] = String(nodes[v].i);
    }
    return { tag, cls: classes, attrs, kids, pretty, hint };
  };

  const toHtml = (v, indent = 0) => {
    if ('text' in v) return escHtml(v.text, false);
    if ('raw' in v) return v.raw;
    const tag = v.tag;
    const open = `<${tag}` + (v.cls ? ` class="${v.cls}"` : '') + attrStr(v.attrs) + '>';
    if (VOID.has(tag)) return open;
    if (!v.kids.length) return open + `</${tag}>`;
    if (v.pretty) {
      const pad = '  '.repeat(indent + 1);
      return open + v.kids.map((kid) => `\n${pad}${toHtml(kid, indent + 1)}`).join('') + `\n${'  '.repeat(indent)}</${tag}>`;
    }
    return open + v.kids.map((kid) => toHtml(kid, indent)).join('') + `</${tag}>`;
  };

  // ---------------------------------------------------------------- Astro

  // Runs of 3+ structurally identical siblings become `{list.map((item) => (...))}`; whatever differs between
  // them (text, attributes, classes, inline SVGs) becomes a field of the item, and the list a prop whose
  // default is the captured content.
  const MIN_REPEAT = 3;
  const TEXT_NAMES = { h1: 'title', h2: 'title', h3: 'title', h4: 'title', h5: 'title', h6: 'title', strong: 'title',
    p: 'description', small: 'note', a: 'label', button: 'label', label: 'label', li: 'text', span: 'text' };

  // A value that comes from the loop item (or, with prop set, a prop of the component) instead of being
  // written literally.
  class Field {
    constructor(name, prop = false) { this.name = name; this.prop = prop; }
    ref(item) { return this.prop ? this.name : `${item}.${this.name}`; }
  }

  const camel = (s) => {
    const parts = s.split(/[^a-zA-Z0-9]+/).filter(Boolean);
    return parts.length ? parts[0].toLowerCase() + parts.slice(1).map((p) => p[0].toUpperCase() + p.slice(1)).join('') : 'value';
  };
  const pascal = (s) => { const c = camel(s); return c[0].toUpperCase() + c.slice(1); };
  const plural = (s) => {
    if (s.endsWith('y') && !'aeiou'.includes(s.slice(-2, -1))) return s.slice(0, -1) + 'ies';
    return s + (/(s|x|ch|sh)$/.test(s) ? 'es' : 's');
  };

  // 'cformwrap__card' -> 'card', 'service-card--big' -> 'serviceCard', else the tag name.
  const hintWord = (v) => {
    const h = (v.hint || '').split('--')[0].split('__').pop();
    if (h && !/^\d/.test(h)) return camel(h);
    return ['div', 'span'].includes(v.tag) ? 'item' : v.tag;
  };

  const shape = (v) => ('text' in v ? 'T' : 'raw' in v ? 'svg' : 'comp' in v ? `<${v.comp}>`
    : `(${v.tag}:${v.kids.map(shape).join(',')})`);

  function* runs(kids) {
    let i = 0;
    while (i < kids.length) {
      let j = i;
      if ('kids' in kids[i]) {
        const s = shape(kids[i]);
        while (j + 1 < kids.length && 'kids' in kids[j + 1] && shape(kids[j + 1]) === s) j++;
      }
      if (j - i + 1 >= MIN_REPEAT) yield [i, j + 1];
      i = j + 1;
    }
  }

  class Loop {
    constructor(list, item) { this.list = list; this.item = item; this.names = []; this.columns = []; }

    add(name, values) {
      const base = name;
      for (let i = 2; this.names.includes(name); i++) name = `${base}${i}`;
      this.names.push(name);
      this.columns.push(values);
      return new Field(name);
    }

    items() {
      const rows = [];
      for (let i = 0; i < (this.columns.length ? this.columns[0].length : 0); i++) {
        const row = {};
        this.names.forEach((n, j) => { if (this.columns[j][i] !== null && this.columns[j][i] !== undefined) row[n] = this.columns[j][i]; });
        rows.push(row);
      }
      return rows;
    }

    tsType() {
      return this.names.map((n, j) => {
        const col = this.columns[j];
        const types = unique(col.filter((x) => x !== null && x !== undefined)
          .map((x) => (typeof x === 'boolean' ? 'boolean' : 'string'))).sort();
        const optional = col.some((x) => x === null || x === undefined) ? '?' : '';
        return `  ${n}${optional}: ${types.join(' | ') || 'string'};`;
      }).join('\n');
    }
  }

  // 'md:mt-auto' -> 'mt', '-left-4' -> 'left': classes sharing a key may set the same property
  // (at some breakpoint, so variants are ignored).
  const utilityKey = (c) => c.split(':').pop().replace(/^-+/, '').split('-')[0];

  // Items that differ only by classes the others don't set at all (typically mt-auto that resolved to 0
  // elsewhere) can share the union. Any overlap in utility keys means a real difference: null.
  const unionClasses = (lists) => {
    const sets = lists.map(words);
    const union = unique(sets.flat());
    for (const c of union) {
      const missing = sets.filter((s) => !s.includes(c));
      if (missing.some((s) => s.some((o) => utilityKey(c) === utilityKey(o)))) return null;
    }
    return union.join(' ');
  };

  // Merge same-shaped nodes into one node whose differing parts are Fields of `loop`.
  const template = (vs, parentTag, loop) => {
    const v0 = vs[0];
    if ('text' in v0) {
      const vals = vs.map((v) => v.text);
      return unique(vals).length === 1 ? v0 : { field: loop.add(TEXT_NAMES[parentTag] || 'text', vals) };
    }
    if ('raw' in v0) {
      const vals = vs.map((v) => v.raw);
      return unique(vals).length === 1 ? v0 : { field: loop.add('icon', vals), html: true };
    }
    const t = { ...v0 };
    const classes = vs.map((v) => v.cls);
    if (unique(classes).length > 1) {
      const merged = unionClasses(classes);
      if (merged) t.cls = merged;
      else {
        // keep what every item shares in the template, only the differences go into the data
        const sets = classes.map(words);
        const common = sets[0].filter((c) => sets.every((s) => s.includes(c)));
        const extra = sets.map((s) => s.filter((c) => !common.includes(c)).join(' ') || null);
        t.cls = [common.join(' '), loop.add(`${camel(v0.tag)}Class`, extra)];
      }
    }
    t.attrs = {};
    for (const k of unique(vs.flatMap((v) => Object.keys(v.attrs)))) {
      const vals = vs.map((v) => (k in v.attrs ? v.attrs[k] : null));
      t.attrs[k] = unique(vals).length === 1 ? vals[0] : loop.add(camel(k), vals.map((x) => (x === '' ? true : x)));
    }
    t.kids = v0.kids.map((_, i) => template(vs.map((v) => v.kids[i]), v0.tag, loop));
    return t;
  };

  // Replace runs of repeated siblings with loop nodes, outermost first.
  const loopify = (v, loops) => {
    if (!('kids' in v)) return v;
    const kids = v.kids;
    let out = [], last = 0;
    if (v.pretty) {
      for (const [a, b] of runs(kids)) {
        out = out.concat(kids.slice(last, a));
        const word = hintWord(kids[a]);
        // list names and item names (which become TypeScript interfaces) must both be unique
        const taken = new Set(loops.flatMap((lp) => [lp.list, lp.item]));
        let list = plural(word);
        for (let i = 2; taken.has(list); i++) list = `${plural(word)}${i}`;
        let item = word !== list ? word : 'item';
        for (let i = 2, base = item; taken.has(item) || item === list; i++) item = `${base}${i}`;
        const loop = new Loop(list, item);
        loops.push(loop);
        out.push({ loop, body: template(kids.slice(a, b), v.tag, loop) });
        last = b;
      }
    }
    out = out.concat(kids.slice(last));
    return { ...v, kids: out.map((k) => ('loop' in k ? k : loopify(k, loops))) };
  };

  const escText = (s) => escHtml(s, false).replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');

  const write = (v, indent = 0, item = null) => {
    const pad = '  '.repeat(indent);
    if ('field' in v) {
      const expr = v.field.ref(item);
      return v.html ? `<Fragment set:html={${expr}} />` : `{${expr}}`;
    }
    if ('loop' in v) {
      const lp = v.loop;
      return `{${lp.list}.map((${lp.item}) => (\n${pad}  ${write(v.body, indent + 1, lp.item)}\n${pad}))}`;
    }
    if ('comp' in v) return `<${v.comp} />`;
    if ('text' in v) return escText(v.text);
    if ('raw' in v) return v.raw;
    const tag = v.tag, c = v.cls;
    let open = `<${tag}`;
    if (Array.isArray(c)) {
      const [common, field] = c;
      open += common ? ` class:list={[${JSON.stringify(common)}, ${item}.${field.name}]}` : ` class={${item}.${field.name}}`;
    } else if (c) open += ` class="${c}"`;
    const entries = Object.entries(v.attrs);
    open += attrStr(Object.fromEntries(entries.filter(([, x]) => !(x instanceof Field))));
    open += entries.filter(([, x]) => x instanceof Field).map(([k, x]) => ` ${k}={${x.ref(item)}}`).join('');
    open += '>';
    if (VOID.has(tag)) return open;
    if (!v.kids.length) return open + `</${tag}>`;
    if (v.pretty) return open + v.kids.map((k) => `\n${pad}  ${write(k, indent + 1, item)}`).join('') + `\n${pad}</${tag}>`;
    return open + v.kids.map((k) => write(k, indent, item)).join('') + `</${tag}>`;
  };

  // The component's own content as props, so it can be reused with other copy: headings, paragraphs, link
  // and button labels and targets, image sources. Only elements holding plain text (an <h1> with an <em>
  // inside stays as written), outside loops (their items are props already), at most MAX_PROPS.
  const MAX_PROPS = 24;
  const PROP_NAMES = { h1: 'title', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading',
    p: 'text', a: 'label', button: 'label' };

  class Props {
    constructor(reserved) { this.names = []; this.values = []; this.taken = new Set(reserved); }

    add(name, value) {
      const base = name;
      for (let i = 2; this.taken.has(name); i++) name = `${base}${i}`;
      this.taken.add(name);
      this.names.push(name);
      this.values.push(value);
      return new Field(name, true);
    }

    get full() { return this.names.length >= MAX_PROPS; }
  }

  const propify = (v, props) => {
    if (!('kids' in v) || 'loop' in v || props.full) return v;
    const out = { ...v, attrs: { ...v.attrs } };
    const only = v.kids.length === 1 && 'text' in v.kids[0] && v.kids[0].text.trim() ? v.kids[0].text : null;
    if (only !== null && PROP_NAMES[v.tag]) {
      const name = PROP_NAMES[v.tag];
      out.kids = [{ field: props.add(name, only.trim()) }];
      if (v.tag === 'a' && typeof v.attrs.href === 'string') out.attrs.href = props.add(name === 'label' ? 'href' : `${name}Href`, v.attrs.href);
      return out;
    }
    if (v.tag === 'img' && typeof v.attrs.src === 'string' && !v.attrs.src.startsWith('data:')) {
      out.attrs.src = props.add('image', v.attrs.src);
      if (typeof v.attrs.alt === 'string' && v.attrs.alt) out.attrs.alt = props.add('imageAlt', v.attrs.alt);
      return out;
    }
    out.kids = v.kids.map((k) => propify(k, props));
    return out;
  };

  // Clone page: the page's sections (header, hero, sections, footer…) become components of their own that the
  // page component imports. Found below the wrapper divs frameworks add (#__next, #app), one level into
  // <main>; the divs next to real sections count as sections too. Fewer than two: no split.
  const SECTION_TAGS = new Set(['header', 'nav', 'section', 'footer', 'aside', 'article']);
  const isEl = (k) => k && 'kids' in k;
  const findSections = (root) => {
    let box = root;
    for (let d = 0; d < 6; d++) {
      const els = box.kids.filter(isEl);
      if (els.length !== 1 || SECTION_TAGS.has(els[0].tag)) break;
      box = els[0];
    }
    const level = box.kids.filter(isEl).flatMap((k) => (k.tag === 'main' && k.kids.some(isEl) ? k.kids.filter(isEl) : [k]));
    if (!level.some((k) => SECTION_TAGS.has(k.tag))) return [];
    const found = level.filter((k) => SECTION_TAGS.has(k.tag) || (k.tag === 'div' && k.kids.some(isEl)));
    return found.length >= 2 ? found : [];
  };

  const sectionName = (v, seenHeader, taken) => {
    const word = { header: 'Header', footer: 'Footer', nav: 'Nav', aside: 'Sidebar' }[v.tag]
      || (seenHeader && !taken.has('Hero') && hasTag(v, 'h1') ? 'Hero' : '')
      || (v.hint && !/^\d/.test(v.hint) ? pascal(v.hint.split('--')[0].split('__').pop()) : 'Section');
    let name = /^[A-Za-z]/.test(word) ? word : 'Section';
    for (let i = 2, base = name; taken.has(name); i++) name = `${base}${i}`;
    taken.add(name);
    return name;
  };
  const hasTag = (v, tag) => isEl(v) && (v.tag === tag || v.kids.some((k) => hasTag(k, tag)));

  // One .astro file: [name, code]. Section nodes in `parts` (node -> name) are written as <Name />.
  const component = (tree, name, sourceUrl, parts = new Map(), dir = '') => {
    const loops = [];
    const swap = (v) => (parts.has(v) ? { comp: parts.get(v) } : isEl(v) ? { ...v, kids: v.kids.map(swap) } : v);
    const looped = loopify(swap(tree), loops);
    const props = new Props(loops.flatMap((lp) => [lp.list, lp.item]));
    const body = write(propify(looped, props));
    const front = [sourceUrl ? `// Generated by MirrorUI from ${sourceUrl}` : '// Generated by MirrorUI'];
    if (parts.size) front.push([...parts.values()].map((p) => `import ${p} from './${dir}/${p}.astro';`).join('\n'));
    for (const lp of loops) front.push(`interface ${pascal(lp.item)} {\n${lp.tsType()}\n}`);
    if (loops.length || props.names.length) {
      front.push(`interface Props {\n${props.names.map((n) => `  ${n}?: string;`)
        .concat(loops.map((lp) => `  ${lp.list}?: ${pascal(lp.item)}[];`)).join('\n')}\n}`);
      const defaults = props.names.map((n, i) => `  ${n} = ${JSON.stringify(props.values[i])}`)
        .concat(loops.map((lp) => `  ${lp.list} = ${JSON.stringify(lp.items(), null, 2)}`.replace(/\n/g, '\n  '))).join(',\n');
      front.push(`const {\n${defaults},\n} = Astro.props;`);
    }
    return [name, '---\n' + front.join('\n\n') + '\n---\n\n' + body + '\n'];
  };

  // The component, or for a page its sections too: [{name, path, code}], main first; paths are relative to
  // src/components/.
  const components = (tree, sourceUrl) => {
    let name = tree.hint ? pascal(tree.hint) : 'Component';
    if (!/^[A-Za-z]/.test(name)) name = 'Component';
    if (tree.hint === 'page') {
      const host = (() => { try { return new URL(sourceUrl).hostname.replace(/^www\./, '').split('.')[0]; } catch { return ''; } })();
      if (/^[a-z]/i.test(host)) name = pascal(host) + 'Page';
    }
    const sections = tree.hint === 'page' ? findSections(tree) : [];
    const dir = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    const parts = new Map(), taken = new Set([name]);
    let seenHeader = false;
    for (const s of sections) {
      parts.set(s, sectionName(s, seenHeader, taken));
      seenHeader = seenHeader || s.tag === 'header' || s.tag === 'nav';
    }
    const [, code] = component(tree, name, sourceUrl, parts, dir);
    return [{ name, path: `${name}.astro`, code }].concat([...parts].map(([node, part]) => {
      const [, partCode] = component(node, part, sourceUrl);
      return { name: part, path: `${dir}/${part}.astro`, code: partCode };
    }));
  };

  // ---------------------------------------------------------------- entry point

  // captures: extract.js results, one per viewport (the widest may carry `hover`, any may carry `fontSheets`).
  // options: {sourceUrl, tailwindSrc, fonts: bool, fontFiles: {url: dataUrl}, preview: bool}
  // preview: for showing in an iframe that is sized to its content (see screenClass)
  const build = (captures, options = {}) => {
    screenAsPx = !!options.preview;
    traceWidth = options.trace || 0;
    captures = [...captures].sort((a, b) => a.vw - b.vw);
    const viewports = captures.map((c) => ({ vw: c.vw, vh: c.vh, vcw: c.vcw, vch: c.vch }));
    const bps = breakpoints(viewports);
    const roots = captures.map((c) => c.root);
    const hover = captures[captures.length - 1].hover || {};
    // hovered elements whose hover restyles a descendant become Tailwind groups
    const groups = new Set(Object.entries(hover)
      .filter(([i, byNode]) => Object.keys(byNode).some((j) => j !== i)).map(([i]) => +i));
    const ctx = { hover, states: captures[captures.length - 1].states || {}, groups, groupNames: null };
    // canvas drawings photographed by the runner, onto their nodes (see render)
    for (const c of captures) {
      const visit = (n) => {
        if (!n || 'text' in n) return;
        if (['canvas', 'video'].includes(n.t) && !n.snap && c.canvas && c.canvas[n.i]) n.snap = c.canvas[n.i];
        (n.c || []).forEach(visit);
      };
      visit(c.root);
    }
    // Unnamed groups fire for any hovered ancestor group, so nested groups get names. Names come from the
    // class or tag (not the index) so repeated items keep identical classes.
    const names = new Map();
    let nested = false;
    const walkGroups = (n, inside) => {
      if (!n || 'text' in n) return;
      const isGroup = groups.has(n.i);
      if (isGroup) {
        nested = nested || inside;
        names.set(n.i, camel((n.cn || '').split('--')[0].split('__').pop() || n.t));
      }
      (n.c || []).forEach((c) => walkGroups(c, inside || isGroup));
    };
    walkGroups(captures[captures.length - 1].root, false);
    if (nested) ctx.groupNames = names;
    const theme = new Theme();
    collect(roots, theme, ctx);
    const backdrop = captures[captures.length - 1].bg || 'rgb(255, 255, 255)';
    theme.addColor(backdrop);
    theme.finalize();
    const tree = render(roots, roots.map(() => null), viewports, theme, bps, ctx);
    const faces = options.fonts ? fontCss(captures, options.fontFiles) : '';
    const fragment = toHtml(tree);
    const themeCss = theme.css();
    // The page around the component isn't part of it, but its side gutters are needed for a fair comparison.
    // Measured from the margin box: the root's own margins (e.g. Bootstrap's negative row margins) are in its classes.
    // Exact values, plus the original's sub-pixel vertical offset: text rasterizes differently at y=534.98
    // than at y=535, and that alone reads as a 1px shift of everything in the comparison.
    const margin = (r, side) => px(r.s[`margin-${side}`]) || 0;
    const exact = (v) => (Math.abs(v) < 0.01 ? '0' : `[${num(v)}px]`);
    const gutters = {
      t: captures.map((c) => [exact(c.rect ? c.rect.y - Math.floor(c.rect.y) : 0), false]),
      b: roots.map(() => ['0', true]),
      // an element without a box (display:contents, hidden) at some width has no position to reproduce
      l: roots.map((r) => [r.w < 1 ? '0' : exact(r.x - margin(r, 'left')), false]),
      r: roots.map((r, i) => [r.w < 1 ? '0' : exact(viewports[i].vw - r.x - r.w - margin(r, 'right')), false]),
    };
    const frameClasses = sideLayers('p', gutters, bps).concat(theme.color('bg', backdrop)).join(' ');
    const doc = `<!doctype html>
<html lang="${escHtml(captures[0].lang || 'en', true)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(captures[0].title || 'MirrorUI', true)}</title>
<script src="${options.tailwindSrc || TAILWIND_CDN}"></script>${faces ? `\n<style>\n${faces}\n</style>` : ''}
<style type="text/tailwindcss">
${themeCss}
</style>
</head>
<body>
<div id="mirrorui-frame" class="${frameClasses}">
${fragment}
</div>
</body>
</html>
`;
    const comps = components(tree, options.sourceUrl || '');
    const themeFile = '@import "tailwindcss";\n\n' + (faces ? faces + '\n\n' : '') + themeCss + '\n';
    return { doc, fragment, theme: themeCss, themeFile, astroName: comps[0].name, astro: comps[0].code, components: comps };
  };

  globalThis.MirrorUICompile = { build, fontFaces, FONT_TYPES, Theme };
})();
