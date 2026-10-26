// Swap font: try any Google Font (or an installed one) on the page's headings, body text or both, live.
// Text elements are marked as heading or body once (icon fonts left alone) and a constructed stylesheet sets
// their font-family; fonts are fetched by the service worker and added with the FontFace API, so the page's
// CSP can't block either. Undo steps back, Revert restores the original fonts; like Edit text and Arrange,
// the change stays when the toolbar closes and goes away on reload. Pick and Clone page capture the swapped
// fonts, so a clone can come out in the new typeface.
(() => {
  const { h, button } = MUI;
  const SAMPLE = 'The quick brown fox jumps over the lazy dog';
  const PAGE = 40;
  const CATEGORIES = { all: 'All', 'Sans Serif': 'Sans', Serif: 'Serif', Display: 'Display', Handwriting: 'Handwriting', Monospace: 'Mono' };
  const GENERIC = { 'Sans Serif': 'sans-serif', Serif: 'serif', Display: 'sans-serif', Handwriting: 'cursive', Monospace: 'monospace' };
  const ICON_FONT = /icon|awesome|material|glyph|symbol|fontello|icomoon|dashicons|ionicons|feather/i;

  let panel = null;
  let catalog = null;
  let catalogError = null;
  let scope = 'all';
  let query = '';
  let category = 'all';
  let shown = PAGE;
  let applied = { h: null, b: null };   // {family, generic, local} per scope
  let history = [];
  let marked = false; // marks stay after Revert so Undo can bring a font back
  const usage = { h: { weights: new Set(), italic: false }, b: { weights: new Set(), italic: false } };
  let observer = null;
  const sheet = new CSSStyleSheet();
  const loaded = new Map();   // alias -> Promise
  const previews = new Set();

  const b64ToBuffer = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)).buffer;
  const quote = (name) => `"${name.replace(/"/g, '')}"`;
  // FontFace family names for our copies: plain characters only, prefixed so they never clash with the page's
  const aliasOf = (kind, spec) => `mui ${kind} ${spec.replace(/[^A-Za-z0-9 ]+/g, ' ')}`;

  // ---------------------------------------------------------------- page marking

  function mark() {
    if (marked) return;
    for (const el of MUI.visibleElements()) {
      const formish = ['input', 'textarea', 'select', 'button'].includes(el.tagName.toLowerCase());
      if (!formish && !MUI.hasOwnText(el)) continue;
      const cs = getComputedStyle(el);
      // icon fonts would turn into letters; code keeps its monospace
      if (ICON_FONT.test(cs.fontFamily.split(',')[0]) || /monospace/.test(cs.fontFamily)) continue;
      const role = el.closest('h1, h2, h3, h4, h5, h6, [role="heading"]') ? 'h' : 'b';
      el.setAttribute('data-mui-font', role);
      usage[role].weights.add(Number(cs.fontWeight) || 400);
      if (cs.fontStyle === 'italic') usage[role].italic = true;
    }
    marked = true;
  }

  function writeSheet() {
    const rule = (role) => {
      const f = applied[role];
      return f ? `[data-mui-font="${role}"] { font-family: ${quote(f.alias)}, ${f.generic} !important; }` : '';
    };
    sheet.replaceSync(rule('h') + rule('b'));
    const has = document.adoptedStyleSheets.includes(sheet);
    if (applied.h || applied.b) { if (!has) document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]; }
    else if (has) document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
  }

  // ---------------------------------------------------------------- font loading

  // scripts the page's text needs beyond latin
  function subsets() {
    const text = (document.body.innerText || '').slice(0, 20000);
    const out = ['latin', 'latin-ext'];
    if (/[Ѐ-ӿ]/.test(text)) out.push('cyrillic', 'cyrillic-ext');
    if (/[Ͱ-Ͽ]/.test(text)) out.push('greek', 'greek-ext');
    if (/[Ạ-ỹ]/.test(text)) out.push('vietnamese');
    return out;
  }

  // css2 spec for the weights a scope uses: the whole range of a variable font, the nearest static weights otherwise
  function specFor(entry, roles) {
    const used = new Set(roles.flatMap((r) => [...usage[r].weights]));
    const italic = entry.italic && roles.some((r) => usage[r].italic);
    if (entry.wght) {
      const range = `${entry.wght[0]}..${entry.wght[1]}`;
      return italic ? `${entry.family}:ital,wght@0,${range};1,${range}` : `${entry.family}:wght@${range}`;
    }
    const nearest = (w) => entry.weights.reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a), entry.weights[0] || 400);
    const weights = [...new Set([...(used.size ? used : [400])].map(nearest))].sort((a, b) => a - b);
    if (italic) return `${entry.family}:ital,wght@${[0, 1].flatMap((i) => weights.map((w) => `${i},${w}`)).join(';')}`;
    return weights.length === 1 && weights[0] === 400 ? entry.family : `${entry.family}:wght@${weights.join(';')}`;
  }

  async function addFaces(alias, msg) {
    const res = await MUI.send({ type: 'google-font', ...msg });
    if (!res || res.error) throw new Error(res ? res.error : 'no answer');
    await Promise.all(res.faces.map(async (f) => {
      const face = new FontFace(alias, b64ToBuffer(f.data), { style: f.style, weight: f.weight, unicodeRange: f.unicodeRange });
      document.fonts.add(await face.load());
    }));
  }

  const load = (alias, msg) => {
    if (!loaded.has(alias)) loaded.set(alias, addFaces(alias, msg).catch((e) => { loaded.delete(alias); throw e; }));
    return loaded.get(alias);
  };

  // ---------------------------------------------------------------- applying

  const roles = () => (scope === 'all' ? ['h', 'b'] : [scope]);

  async function apply(entry) {
    mark();
    const targets = roles();
    let font;
    if (entry.local) font = { family: entry.family, alias: entry.family, generic: 'sans-serif', local: true };
    else {
      const spec = specFor(entry, targets);
      const alias = aliasOf('font', spec);
      MUI.toast(`Loading ${entry.family}…`);
      try {
        await load(alias, { spec, subsets: subsets() });
      } catch (e) {
        MUI.toast(`Couldn't load ${entry.family}: ${e.message}`);
        return;
      }
      font = { family: entry.family, alias, generic: GENERIC[entry.category] || 'sans-serif', spec };
      // extract.js turns our alias back into the real name, so Pick and Clone page output says "Lora"
      MUI.fontAliases = { ...MUI.fontAliases, [alias]: entry.family };
    }
    history.push({ ...applied });
    for (const r of targets) applied[r] = font;
    writeSheet();
    MUI.toast(`${entry.family} on ${scope === 'all' ? 'all text' : scope === 'h' ? 'headings' : 'body text'}`);
    render();
  }

  function undo() {
    if (!history.length) return;
    applied = history.pop();
    writeSheet();
    render();
  }

  function revert() {
    if (applied.h || applied.b) history.push({ ...applied });
    applied = { h: null, b: null };
    writeSheet();
    render();
  }

  // the chosen fonts as code: a Google Fonts link, CSS rules and Tailwind theme tokens
  function css() {
    const fonts = [...new Set([applied.h, applied.b].filter(Boolean))];
    const google = fonts.filter((f) => f.spec).map((f) => `family=${encodeURIComponent(f.spec).replace(/%20/g, '+')}`);
    const stack = (f) => `${quote(f.family)}, ${f.generic}`;
    const token = (f) => `--font-${f.family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    return [
      google.length ? `<link href="https://fonts.googleapis.com/css2?${google.join('&')}&display=swap" rel="stylesheet">\n` : '',
      applied.h ? `h1, h2, h3, h4, h5, h6 { font-family: ${stack(applied.h)}; }` : '',
      applied.b ? `body { font-family: ${stack(applied.b)}; }` : '',
      `\n@theme {\n${fonts.map((f) => `  ${token(f)}: ${stack(f)};`).join('\n')}\n}`,
    ].filter(Boolean).join('\n');
  }

  // ---------------------------------------------------------------- list

  const matches = () => (catalog || []).filter((f) => (category === 'all' || f.category === category)
    && (!query || f.family.toLowerCase().includes(query.toLowerCase())));

  // previews load a few-KB subset with just the sample's letters, only once the card scrolls into view
  function preview(card, entry) {
    const alias = aliasOf('preview', entry.family);
    card.querySelector('.sample').style.fontFamily = `${quote(alias)}, ${GENERIC[entry.category] || 'sans-serif'}`;
    if (previews.has(entry.family)) return;
    observer.observe(card);
    card._load = () => {
      previews.add(entry.family);
      load(alias, { spec: entry.family, text: `${SAMPLE}Aa` }).catch(() => {});
    };
  }

  function fontCard(entry) {
    const current = [applied.h, applied.b].some((f) => f && f.family === entry.family);
    const card = h('button', { class: `font font-pick${current ? ' current' : ''}`, onclick: () => apply(entry),
      title: `Use ${entry.family} for ${scope === 'all' ? 'all text' : scope === 'h' ? 'headings' : 'body text'}` },
    h('div', { class: 'name' }, h('span', { text: entry.family }), h('span', { class: 'spacer' }),
      h('span', { class: 'muted small', text: `${entry.category}${entry.wght ? ' · variable' : ` · ${entry.weights.length} weights`}` })),
    h('div', { class: 'sample', text: SAMPLE }));
    preview(card, entry);
    return card;
  }

  // the page's own fonts, read before anything is swapped (afterwards the scan would see our copies)
  let originalFonts = null;
  function originals() {
    if (!originalFonts || !(applied.h || applied.b)) originalFonts = MUI.scanFonts().filter((f) => !ICON_FONT.test(f.name) && !f.name.startsWith('mui '));
    const fonts = originalFonts;
    const now = (r) => (applied[r] ? applied[r].family : 'original');
    return h('div', { class: 'font' },
      h('div', { class: 'name' }, h('span', { text: 'On this page' }), h('span', { class: 'spacer' }),
        h('span', { class: 'muted small', text: `headings: ${now('h')} · body: ${now('b')}` })),
      h('div', { class: 'chips', style: { marginTop: '8px' } }, fonts.map((f) => h('span', { class: 'chip', text: `${f.name} ×${f.count}` }))));
  }

  function render() {
    if (!panel) return;
    observer?.disconnect();
    observer = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting && e.target._load) { e.target._load(); e.target._load = null; observer.unobserve(e.target); }
    }, { root: panel.body, rootMargin: '200px' });
    const scopeBtn = (k, label) => button(label, { pressed: scope === k, onclick: () => { scope = k; render(); } });
    panel.setSubtitle(catalog ? `${catalog.length.toLocaleString()} Google Fonts · click one to use it` : 'Loading Google Fonts…');
    panel.setActions([
      h('div', { class: 'seg' }, scopeBtn('all', 'All text'), scopeBtn('h', 'Headings'), scopeBtn('b', 'Body')),
      h('div', { class: 'spacer' }),
      button('', { icon: 'undo', onclick: undo, title: 'Undo' }),
      button('Revert', { onclick: revert, title: 'Back to the original fonts' }),
      (applied.h || applied.b) ? button('', { icon: 'copy', onclick: () => MUI.copy(css(), 'Font CSS copied'), title: 'Copy the chosen fonts as CSS' }) : null,
    ]);
    const search = h('input', { type: 'search', placeholder: 'Search fonts…', value: query });
    search.addEventListener('input', () => { query = search.value; shown = PAGE; renderList(); });
    const cats = h('div', { class: 'seg', style: { margin: '8px 0 10px' } }, Object.entries(CATEGORIES)
      .map(([k, label]) => button(label, { pressed: category === k, onclick: () => { category = k; shown = PAGE; render(); } })));
    const localInput = h('input', { type: 'text', placeholder: 'Installed font name, e.g. Segoe UI', spellcheck: 'false' });
    const local = h('div', { class: 'row', style: { marginTop: '8px' } }, h('div', { style: { flex: '1' } }, localInput),
      button('Use', { onclick: () => localInput.value.trim() && apply({ family: localInput.value.trim(), local: true }) }));
    listEl = h('div');
    panel.setBody([originals(), h('div', { style: { margin: '12px 0 0' } }, search), cats, listEl,
      h('div', { class: 'section', text: 'Installed font' }), local]);
    renderList();
    search.focus();
  }

  let listEl = null;
  function renderList() {
    if (!listEl) return;
    if (catalogError) {
      listEl.replaceChildren(h('div', { class: 'error', text: `Google Fonts list unavailable: ${catalogError}. You can still use an installed font below.` }));
      return;
    }
    if (!catalog) { listEl.replaceChildren(h('div', { class: 'empty', text: 'Loading Google Fonts…' })); return; }
    const list = matches();
    listEl.replaceChildren(...[
      h('p', { class: 'muted small', text: `${list.length.toLocaleString()} font families` }),
      ...list.slice(0, shown).map(fontCard),
      list.length > shown ? button(`Show ${Math.min(PAGE, list.length - shown)} more`, { onclick: () => { shown += PAGE; renderList(); } }) : null,
    ].filter(Boolean));
  }

  async function start() {
    panel = MUI.panel({ title: 'Swap font', subtitle: 'Loading Google Fonts…' });
    render();
    if (!catalog) {
      const res = await MUI.send({ type: 'font-catalog' });
      if (res && res.list) catalog = res.list; else catalogError = res ? res.error : 'no answer';
    }
    if (panel) render();
  }

  function stop() {
    observer?.disconnect();
    observer = null;
    panel = null;
    listEl = null;
  }

  MUI.tools.swap = { label: 'Swap font', icon: 'swap', title: 'Try other fonts on this page', start, stop };
})();
