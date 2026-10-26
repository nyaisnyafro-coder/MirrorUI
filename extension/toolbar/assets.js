// Assets: images, inline SVGs (with page sprites inlined), CSS background images, videos and icons on the
// page. Filter by kind, copy URLs or SVG markup, download one or a selection.
(() => {
  const { h, button } = MUI;
  let panel = null;
  let assets = [];
  let filter = 'all';
  let selected = new Set();

  const KINDS = { all: 'All', image: 'Images', svg: 'SVG', background: 'Backgrounds', video: 'Videos' };
  const urlsIn = (value) => [...value.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)].map((m) => m[2]);

  function typeOf(a) {
    if (a.kind === 'svg') return 'SVG';
    const m = /^data:image\/([a-z0-9+.-]+)/i.exec(a.url) || /\.([a-z0-9]{2,5})(?:[?#]|$)/i.exec(new URL(a.url, location.href).pathname);
    return m ? m[1].replace('svg+xml', 'svg').replace('jpeg', 'jpg').toUpperCase() : 'IMG';
  }

  function scan() {
    const seen = new Map();
    const add = (a) => {
      const key = a.markup ? `svg:${a.markup}` : a.url;
      if (!key || seen.has(key)) return;
      a.id = seen.size;
      seen.set(key, a);
    };
    for (const img of document.images) {
      const url = img.currentSrc || img.src;
      if (url) add({ kind: 'image', url, w: img.naturalWidth, h: img.naturalHeight, label: img.alt || '' });
    }
    for (const svg of document.querySelectorAll('svg')) {
      if (svg.parentElement && svg.parentElement.closest('svg')) continue;
      const r = svg.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      add({ kind: 'svg', markup: MirrorUIExtract.inlineSprites(svg).outerHTML, w: Math.round(r.width), h: Math.round(r.height), label: svg.getAttribute('aria-label') || '' });
    }
    for (const el of MUI.visibleElements()) {
      for (const pseudo of [null, '::before', '::after']) {
        const bg = getComputedStyle(el, pseudo).backgroundImage;
        if (bg && bg !== 'none') for (const url of urlsIn(bg)) add({ kind: 'background', url, label: MUI.describe(el) });
      }
    }
    for (const v of document.querySelectorAll('video')) {
      const url = v.currentSrc || v.src || v.querySelector('source')?.src;
      if (url) add({ kind: 'video', url, w: v.videoWidth, h: v.videoHeight });
      if (v.poster) add({ kind: 'image', url: v.poster, label: 'video poster' });
    }
    for (const link of document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')) {
      if (link.href) add({ kind: 'image', url: link.href, label: 'icon' });
    }
    assets = [...seen.values()];
    selected = new Set();
  }

  const fileName = (a) => {
    if (a.kind === 'svg') return `icon-${a.id + 1}.svg`;
    if (a.url.startsWith('data:')) return `asset-${a.id + 1}.${typeOf(a).toLowerCase()}`;
    const last = decodeURIComponent(new URL(a.url, location.href).pathname.split('/').pop() || '');
    return last.replace(/[^\w.-]+/g, '_') || `asset-${a.id + 1}.${typeOf(a).toLowerCase()}`;
  };

  async function download(a) {
    if (a.kind === 'svg') MUI.download(fileName(a), a.markup, 'image/svg+xml');
    else if (a.url.startsWith('data:') || a.url.startsWith('blob:')) MUI.download(fileName(a), await (await fetch(a.url)).blob());
    else {
      const res = await MUI.send({ type: 'download', url: a.url, filename: fileName(a) });
      if (res && res.error) MUI.toast(`Download failed: ${res.error}`);
    }
  }

  function thumb(a) {
    const box = h('div', { class: 'thumb' });
    if (a.kind === 'svg') {
      // parsed, not innerHTML'd: scripts in parsed documents never run, and Trusted Types pages allow it
      const doc = new DOMParser().parseFromString(a.markup, 'image/svg+xml');
      if (doc.documentElement.nodeName === 'svg') box.append(document.importNode(doc.documentElement, true));
    } else if (a.kind === 'video') {
      box.append(h('video', { src: a.url, muted: true, preload: 'metadata' }));
    } else {
      const img = h('img', { src: a.url, loading: 'lazy', alt: a.label || '' });
      img.addEventListener('load', () => {
        if (!a.w) { a.w = img.naturalWidth; a.h = img.naturalHeight; box.parentElement?.querySelector('.dims')?.replaceChildren(dims(a)); }
      });
      box.append(img);
    }
    const check = h('input', { type: 'checkbox', title: 'Select' });
    check.checked = selected.has(a.id);
    check.addEventListener('change', () => { if (check.checked) selected.add(a.id); else selected.delete(a.id); renderActions(); });
    box.append(check);
    return box;
  }

  const dims = (a) => (a.w ? `${typeOf(a)} · ${a.w} × ${a.h}` : typeOf(a));

  const visible = () => assets.filter((a) => filter === 'all' || a.kind === filter);

  function renderActions() {
    const list = visible();
    const chosen = assets.filter((a) => selected.has(a.id));
    panel.setActions([
      button(chosen.length === list.length && list.length ? 'Select none' : 'Select all', {
        onclick: () => {
          if (chosen.length === list.length) selected = new Set();
          else selected = new Set(list.map((a) => a.id));
          render();
        },
      }),
      button('Copy URLs', {
        icon: 'copy',
        onclick: () => MUI.copy((chosen.length ? chosen : list).filter((a) => a.url).map((a) => a.url).join('\n'), 'URLs copied'),
      }),
      h('div', { class: 'spacer' }),
      button(chosen.length ? `Download ${chosen.length}` : 'Download', {
        icon: 'download', primary: true,
        onclick: async () => { for (const a of chosen.length ? chosen : list) await download(a); },
      }),
      button('', { icon: 'refresh', onclick: () => { scan(); render(); }, title: 'Scan again (scroll first to load lazy images)' }),
    ]);
  }

  function render() {
    const counts = Object.fromEntries(Object.keys(KINDS).map((k) => [k, k === 'all' ? assets.length : assets.filter((a) => a.kind === k).length]));
    panel.setSubtitle(`${assets.length} assets`);
    renderActions();
    const tabs = h('div', { class: 'seg', style: { marginBottom: '12px' } }, Object.entries(KINDS)
      .map(([k, label]) => button(`${label} ${counts[k]}`, { pressed: k === filter, onclick: () => { filter = k; render(); } })));
    const cards = visible().map((a) => h('div', { class: 'asset' }, thumb(a),
      h('div', { class: 'meta' }, h('span', { class: 'dims', title: a.url || a.label, text: dims(a) }),
        h('button', { class: 'btn ghost', title: a.kind === 'svg' ? 'Copy SVG' : 'Copy URL', onclick: () => MUI.copy(a.markup || a.url) }, MUI.icon('copy')),
        h('button', { class: 'btn ghost', title: 'Download', onclick: () => download(a) }, MUI.icon('download')))));
    panel.setBody([tabs,
      cards.length ? h('div', { class: 'grid' }, cards) : h('div', { class: 'empty', text: 'Nothing of this kind here.' }),
      h('p', { class: 'muted small', text: 'Lazy-loaded images appear once you scroll to them; scan again afterwards.' })]);
  }

  function start() {
    panel = MUI.panel({ title: 'Assets', subtitle: 'Scanning…' });
    scan();
    render();
  }

  MUI.tools.assets = { label: 'Assets', icon: 'assets', title: 'Images, SVGs and videos on this page', start, stop: () => { panel = null; } };
})();
