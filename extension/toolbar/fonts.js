// Fonts: the families the page's text actually renders with, their weights and sizes, a live sample in each
// font, and where it comes from (web font or system). Copy the font-family stack or the @font-face rules;
// Highlight outlines the text that uses a family.
(() => {
  const { h, button } = MUI;
  let panel = null;
  let families = [];
  const DEFAULT_SAMPLE = 'The quick brown fox jumps over the lazy dog';
  let sample = DEFAULT_SAMPLE;

  function scan() {
    families = MUI.scanFonts();
  }

  // @font-face rules for one family: readable sheets directly, cross-origin ones fetched by the service worker.
  async function fontFaceCss(f) {
    const sources = MirrorUIExtract.fontSources();
    const fontSheets = [];
    for (const url of sources.sheets) {
      const res = await MUI.send({ type: 'fetch-text', url });
      if (res && res.text) fontSheets.push({ url, text: res.text });
    }
    return MirrorUICompile.fontFaces([{ fonts: sources, fontSheets }], [f.key]).map((x) => x.css).join('\n');
  }

  const topWeight = (f) => [...f.weights].sort((a, b) => b[1] - a[1])[0][0];

  function card(f) {
    const badge = f.web ? h('span', { class: `badge${f.web === 'loaded' ? '' : ' warn'}`, text: f.web === 'loaded' ? 'Web font' : `Web font · ${f.web}` })
      : h('span', { class: 'badge warn', text: 'System font' });
    const weights = [...f.weights.keys()].sort((a, b) => a - b);
    const sizes = [...f.sizes].sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
    return h('div', { class: 'font' },
      h('div', { class: 'name' }, h('span', { text: f.name }), badge, h('span', { class: 'spacer' }),
        h('span', { class: 'muted small', text: `${f.count} text elements` })),
      h('div', { class: 'sample', style: { fontFamily: f.stack, fontWeight: topWeight(f) }, text: sample }),
      h('div', { class: 'section', text: 'Weights' }),
      h('div', { class: 'chips' }, weights.map((w) => h('span', { class: 'chip', style: { fontFamily: f.stack, fontWeight: w }, text: w }))),
      h('div', { class: 'section', text: 'Sizes' }),
      h('div', { class: 'chips' }, sizes.slice(0, 14).map(([s, n]) => h('span', { class: 'chip', text: `${s} ×${n}` }))),
      h('div', { class: 'row', style: { marginTop: '10px' } },
        button('Copy stack', { icon: 'copy', onclick: () => MUI.copy(`font-family: ${f.stack};`, 'font-family copied') }),
        f.web ? button('Copy @font-face', {
          icon: 'copy',
          onclick: async () => {
            const css = await fontFaceCss(f);
            if (css) MUI.copy(css, '@font-face copied');
            else MUI.toast('No readable @font-face rule for this font');
          },
        }) : null,
        button('Highlight', { icon: 'target', onclick: () => MUI.flash(f.els, 3000) })));
  }

  function render() {
    const input = h('input', { type: 'search', placeholder: 'Type to preview…', value: sample === DEFAULT_SAMPLE ? '' : sample });
    input.addEventListener('input', () => {
      sample = input.value || DEFAULT_SAMPLE;
      for (const s of panel.body.querySelectorAll('.sample')) s.textContent = sample;
    });
    panel.setSubtitle(`${families.length} ${families.length === 1 ? 'family' : 'families'} · ${families.reduce((n, f) => n + f.count, 0)} text elements`);
    panel.setActions([
      button('Copy all stacks', {
        icon: 'copy',
        onclick: () => MUI.copy(families.map((f) => `/* ${f.name} */\nfont-family: ${f.stack};`).join('\n\n'), 'Font stacks copied'),
      }),
      h('div', { class: 'spacer' }),
      button('', { icon: 'refresh', onclick: () => { scan(); render(); }, title: 'Scan again' }),
    ]);
    panel.setBody([h('div', { style: { marginBottom: '12px' } }, input),
      families.length ? families.map(card) : h('div', { class: 'empty', text: 'No visible text on this page.' })]);
  }

  function start() {
    panel = MUI.panel({ title: 'Fonts', subtitle: 'Scanning…' });
    scan();
    render();
  }

  MUI.tools.fonts = { label: 'Fonts', icon: 'fonts', title: 'Fonts used on this page', start, stop: () => { panel = null; } };
})();
