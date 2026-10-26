// Pick and Clone page. Pick: hover a component and click it; Clone page: the whole <body>. Either way the
// service worker captures it at each viewport width, and the result (original vs clone, Astro / HTML /
// theme.css) opens in the side panel; "Full view" opens results.html.
(() => {
  const { h, button } = MUI;
  const TAILWIND_LOCAL = 'vendor/tailwindcss-browser.js';
  const DEFAULT_VIEWPORTS = [375, 768, 1280];

  let stopSelect = null;
  let panel = null;
  let progress = null; // {width: element} while a capture runs
  let state = null;    // {job, built, previewDoc, width, tab, fonts, stage}

  const getViewports = async () => ((await chrome.storage.local.get('options')).options || {}).viewports || DEFAULT_VIEWPORTS;

  async function viewportSettings() {
    const viewports = await getViewports();
    const input = h('input', { type: 'text', value: viewports.join(', '), spellcheck: 'false' });
    input.addEventListener('change', async () => {
      const list = [...new Set(input.value.split(/[\s,]+/).map(Number).filter((n) => n >= 240 && n <= 3840))].sort((a, b) => a - b);
      if (list.length) {
        const { options = {} } = await chrome.storage.local.get('options');
        await chrome.storage.local.set({ options: { ...options, viewports: list } });
      }
      input.value = (list.length ? list : viewports).join(', ');
    });
    return [h('div', { class: 'section', text: 'Viewport widths (px)' }), input,
      h('p', { class: 'muted small', text: 'The smallest width gives the base classes, the others md: and lg:. The tab is briefly shown at each width while it is captured.' })];
  }

  async function start() {
    panel = MUI.panel({
      title: 'Pick',
      subtitle: 'Clone a component as Tailwind HTML and Astro',
      body: [h('p', { class: 'muted', text: 'Hover the component you want and click it. ↑ selects the parent, ↓ the first child, Esc stops.' }),
        await viewportSettings()],
    });
    selectMode();
  }

  async function startPage() {
    panel = MUI.panel({
      title: 'Clone page',
      subtitle: document.title || location.hostname,
      actions: [button('Clone this page', { icon: 'clone', primary: true, onclick: () => capture(document.body) })],
      body: [
        h('p', { class: 'muted', text: 'Clones the whole page as one Tailwind HTML document and an Astro page component. Repeated blocks become loops, like with Pick.' }),
        h('p', { class: 'muted small', text: 'Canvas and WebGL drawings become still pictures; videos and JavaScript-driven animation can’t be cloned. Scroll through the page first so lazy content is loaded.' }),
        await viewportSettings(),
      ],
    });
  }

  function selectMode() {
    stopSelect = MUI.select({
      hint: 'Click a component to clone · ↑ parent · ↓ child · Esc stop',
      onHover: (el) => {
        const r = el.getBoundingClientRect();
        MUI.tip([h('b', { text: MUI.describe(el) }), ' ', h('span', { class: 'acc', text: `${Math.round(r.width)} × ${Math.round(r.height)}` })], r);
      },
      onPick: capture,
    });
  }

  function stop() {
    stopSelect?.();
    stopSelect = null;
    state?.stage?.dispose();
    state = null;
    progress = null;
    panel = null;
  }

  async function capture(el) {
    stopSelect?.();
    stopSelect = null;
    const r = el.getBoundingClientRect();
    const description = `${MUI.describe(el)}  ${Math.round(r.width)} × ${Math.round(r.height)}`;
    for (const old of document.querySelectorAll('[data-mirrorui-target]')) old.removeAttribute('data-mirrorui-target');
    el.setAttribute('data-mirrorui-target', '');
    MUI.trackBox('picked', el, 'selected');

    const viewports = await getViewports();
    progress = Object.fromEntries(viewports.map((w) => [w, h('div', { class: 'step' }, h('span', { class: 'dot' }), `${w}px`)]));
    panel.setSubtitle(description);
    panel.setActions(null);
    panel.setBody(h('div', { class: 'progress' },
      h('div', { class: 'muted', text: 'Capturing… the page is shown at each width for a moment.' }),
      Object.values(progress)));

    const res = await MUI.send({ type: 'capture', description });
    MUI.hideBox('picked');
    if (!panel) return; // tool closed meanwhile
    progress = null;
    if (!res || res.error) {
      panel.setBody([h('div', { class: 'error', text: `Capture failed: ${res ? res.error : 'no answer from the extension'}` }),
        h('p', {}, button('Pick again', { icon: 'pick', onclick: again }))]);
      return;
    }
    const key = `job:${res.id}`;
    const job = (await chrome.storage.local.get(key))[key];
    const widths = job.captures.map((c) => c.vw).sort((a, b) => a - b);
    const { options = {} } = await chrome.storage.local.get('options');
    state = { job, tool: MUI.active, width: widths[widths.length - 1], tab: 'astro', fonts: !!options.embedFonts, view: 'clone', fit: true,
      codeHeight: Math.round((innerHeight - 180) * 0.34), modal: null };
    await rebuild();
  }

  // capture progress from the service worker
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type !== 'capture-progress' || !progress) return;
    Object.entries(progress).forEach(([w, el]) => {
      el.className = `step${+w < msg.width ? ' done' : +w === msg.width ? ' now' : ''}`;
    });
  });

  function again() {
    const tool = state ? state.tool : MUI.active;
    state?.stage?.dispose();
    state = null;
    MUI.activate(null);
    MUI.activate(tool);
  }

  async function rebuild() {
    const { job } = state;
    let fontFiles = {};
    if (state.fonts) {
      const urls = [...new Set(MirrorUICompile.fontFaces(job.captures).flatMap((f) => f.urls))];
      fontFiles = (await MUI.send({ type: 'fetch-fonts', urls })).files || {};
    }
    const options = { sourceUrl: job.url, fonts: state.fonts, fontFiles };
    state.built = MirrorUICompile.build(job.captures, options);
    state.previewDoc = MirrorUICompile.build(job.captures, { ...options, tailwindSrc: TAILWIND_LOCAL, preview: true }).doc;
    render();
  }

  const files = () => ({
    astro: [`${state.built.astroName}.astro`, state.built.astro, 'text/plain'],
    html: ['index.html', state.built.doc, 'text/html'],
    theme: ['theme.css', state.built.themeFile, 'text/css'],
  });

  // An Astro-ready folder: the component, theme.css, and the images, videos and fonts it uses under public/
  const downloadZip = async () => {
    const { built } = state;
    const name = built.astroName === 'Component' ? (location.hostname.replace(/^www\./, '') || 'clone') : built.astroName;
    const urls = MirrorUIPackage.urls(built);
    if (urls.length) MUI.toast(`Downloading ${urls.length} asset${urls.length > 1 ? 's' : ''}…`);
    const fetched = urls.length ? ((await MUI.send({ type: 'fetch-assets', urls })).files || {}) : {};
    MUI.download(`${name}.zip`, MirrorUIZip(MirrorUIPackage.files(built, fetched)));
    const missing = urls.filter((u) => !fetched[u]).length;
    if (missing) MUI.toast(`${missing} asset${missing > 1 ? 's' : ''} couldn't be downloaded; see README.md`);
  };

  // The result opens in the large window: code on top, the preview below at a readable size; the splitter
  // between them resizes, and the window itself can be dragged by its header.
  function render() {
    const { job } = state;
    const tool = state.tool;
    if (!state.modal) {
      MUI.closePanel(); // instructions and progress are done; the result needs the room
      state.modal = MUI.modal({ title: tool === 'clone' ? 'Clone page' : 'Pick', subtitle: `${job.description} · ${job.title}`,
        onClose: () => MUI.activate(null) });
    }
    const widths = job.captures.map((c) => c.vw).sort((a, b) => a - b);
    const fonts = h('input', { type: 'checkbox' });
    fonts.checked = state.fonts;
    fonts.addEventListener('change', async () => {
      state.fonts = fonts.checked;
      // remembered for the next clone: on your own site you'll want it every time
      const { options = {} } = await chrome.storage.local.get('options');
      await chrome.storage.local.set({ options: { ...options, embedFonts: state.fonts } });
      await rebuild();
    });
    state.modal.setControls([
      h('div', { class: 'seg' }, widths.map((w) => button(`${w}px`, { pressed: w === state.width, onclick: () => { state.width = w; render(); } }))),
      h('label', { class: 'check', title: "Embeds the page's own font files. Only use fonts you're licensed to use." }, fonts, 'Embed fonts'),
      button('Full view', { icon: 'external', title: 'Open in a tab', onclick: () => MUI.send({ type: 'open-results', id: job.id }) }),
      button(tool === 'clone' ? 'Again' : 'Pick again', { icon: tool === 'clone' ? 'clone' : 'pick', onclick: again }),
      button('Download ZIP', { icon: 'download', primary: true, onclick: downloadZip, title: 'Astro component, theme.css, preview HTML, and the images, videos and fonts it uses' }),
    ]);

    // code
    const tabs = Object.entries({ astro: 'Astro', html: 'HTML', theme: 'theme.css' }).map(([k, label]) => button(label, {
      pressed: k === state.tab, onclick: () => { state.tab = k; render(); },
    }));
    const codePane = h('div', { class: 'code-pane', style: { height: `${state.codeHeight}px` } },
      h('div', { class: 'bar-row2' }, h('div', { class: 'seg' }, tabs), h('div', { class: 'spacer' }),
        button('Copy', { icon: 'copy', onclick: () => MUI.copy(files()[state.tab][1]) }),
        button('Download', { icon: 'download', onclick: () => MUI.download(...files()[state.tab]) })),
      h('pre', { text: files()[state.tab][1] }));
    const splitter = h('div', { class: 'splitter', title: 'Drag to resize' });
    splitter.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const startY = e.clientY, startH = codePane.offsetHeight;
      const max = state.modal.body.offsetHeight - 160;
      const move = (ev) => { state.codeHeight = Math.max(90, Math.min(max, startH + ev.clientY - startY)); codePane.style.height = `${state.codeHeight}px`; };
      const up = () => { removeEventListener('mousemove', move, true); removeEventListener('mouseup', up, true); state.stage?.layout(); };
      addEventListener('mousemove', move, true);
      addEventListener('mouseup', up, true);
    });

    // preview
    const origBox = h('div', { class: 'stage', hidden: state.view === 'clone' });
    const cloneBox = h('div', { class: 'stage', hidden: state.view === 'original' });
    const views = Object.entries({ clone: 'Clone', original: 'Original', compare: 'Side by side' })
      .map(([k, label]) => button(label, { pressed: k === state.view, onclick: () => { state.view = k; render(); } }));
    const zoom = [['fit', 'Fit'], ['full', '100%']]
      .map(([k, label]) => button(label, { pressed: (k === 'fit') === state.fit, onclick: () => { state.fit = k === 'fit'; render(); } }));
    const previewPane = h('div', { class: 'preview-pane' },
      h('div', { class: 'bar-row2' }, h('div', { class: 'seg' }, views), h('div', { class: 'spacer' }),
        h('span', { class: 'muted small', text: `${state.width}px wide` }), h('div', { class: 'seg' }, zoom)),
      h('div', { class: 'preview-scroll' },
        h('div', { class: `preview-grid${state.view === 'compare' ? ' two' : ''}` }, origBox, cloneBox)));
    state.modal.setBody([codePane, splitter, previewPane]);

    state.stage?.dispose();
    state.stage = null;
    const capture = job.captures.find((c) => c.vw === state.width);
    const token = (state.token = (state.token || 0) + 1);
    // the stage measures its boxes, so lay it out once they're in the document (and only for the latest render)
    requestAnimationFrame(() => {
      if (!state || state.token !== token) return;
      state.stage = MirrorUIStage.show(origBox, cloneBox, { capture, shot: job.shots[state.width], doc: state.previewDoc, fit: state.fit });
    });
  }

  MUI.tools.pick = { label: 'Pick', icon: 'pick', title: 'Clone a component', start, stop };
  MUI.tools.clone = { label: 'Clone page', icon: 'clone', title: 'Clone the whole page', start: startPage, stop };
})();
