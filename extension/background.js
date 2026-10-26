// Service worker. The toolbar button (or Alt+Shift+M) toggles the in-page toolbar. When Pick marks an element,
// this captures it at each viewport width by emulating that width on the tab through the DevTools protocol
// (chrome.debugger). It also fetches and downloads on the page's behalf, without the page's CORS limits.
// The page is the user's own tab, so nothing is re-fetched from the site and logins just work.
const TARGET = '[data-mirrorui-target]';
const TOOLBAR_FILES = ['lib/extract.js', 'lib/compile.js', 'lib/stage.js', 'lib/zip.js', 'lib/package.js', 'toolbar/styles.js', 'toolbar/ui.js',
  'toolbar/scan.js', 'toolbar/pick.js', 'toolbar/inspect.js', 'toolbar/design.js', 'toolbar/colors.js', 'toolbar/fonts.js',
  'toolbar/assets.js', 'toolbar/responsive.js', 'toolbar/capture.js', 'toolbar/edit.js', 'toolbar/swap.js',
  'toolbar/arrange.js', 'toolbar/main.js'];
const DEFAULT_OPTIONS = { viewports: [375, 768, 1280] };
const MAX_JOBS = 8;
const MAX_ASSET = 25 * 1024 * 1024;
const VIEWPORT_HEIGHT = 900;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getOptions = async () => ({ ...DEFAULT_OPTIONS, ...(await chrome.storage.local.get('options')).options });

// Runs func in the extension's isolated world of the tab, where lib/extract.js was injected.
const run = async (tabId, func, args = []) => {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return res.result;
};

// Shows or hides the toolbar; injects it the first time.
async function toggleToolbar(tabId) {
  const shown = await run(tabId, () => {
    if (!globalThis.MUI || !globalThis.MUI.order.length) return false;
    globalThis.MUI.toggle();
    return true;
  });
  if (!shown) await chrome.scripting.executeScript({ target: { tabId }, files: TOOLBAR_FILES });
}

const toBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

// Font files as data: URLs, so a clone renders with them anywhere (no CORS, no hotlinking).
async function fetchFonts(urls) {
  const files = {};
  await Promise.all(urls.map(async (url) => {
    try {
      const r = await fetch(url, { credentials: 'omit' });
      const ext = url.split('?')[0].split('.').pop().toLowerCase();
      const type = { woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf' }[ext] || 'font/woff2';
      if (r.ok) files[url] = `data:${type};base64,${toBase64(await r.arrayBuffer())}`;
    } catch { /* that face falls back to the next font in the stack */ }
  }));
  return files;
}

const hoverCandidates = (n) => (!n || 'text' in n ? []
  : (n.hv ? [n.i] : []).concat((n.c || []).flatMap(hoverCandidates)));

const STATES = ['hover', 'focus', 'focus-visible', 'active'];

// Force each state (:hover, :focus…) on each candidate and record what it restyles (the element itself and
// its descendants): {state: {i: diff}}.
async function statePass(send, tabId, root) {
  await send('DOM.enable');
  await send('CSS.enable');
  const { root: doc } = await send('DOM.getDocument', { depth: 0 });
  const out = Object.fromEntries(STATES.map((s) => [s, {}]));
  for (const i of hoverCandidates(root)) {
    const { nodeId } = await send('DOM.querySelector', { nodeId: doc.nodeId, selector: `[data-mui-hover="${i}"]` });
    if (!nodeId) continue;
    for (const state of STATES) {
      await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [state] });
      const diff = await run(tabId, (k) => MirrorUIExtract.hoverDiff(k), [i]);
      await send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
      if (diff && Object.keys(diff).length) out[state][i] = diff;
    }
  }
  await send('CSS.disable');
  await send('DOM.disable');
  return out;
}

const canvasNodes = (n) => (!n || 'text' in n ? []
  : (n.cv ? [n.i] : []).concat((n.c || []).flatMap(canvasNodes)));

// Canvases that can't be read back (WebGL, tainted) photographed alone: {i: data URL}.
async function canvasShots(send, tabId, root) {
  const out = {};
  for (const i of canvasNodes(root).slice(0, 8)) {
    const box = await run(tabId, (k) => MirrorUIExtract.isolate(k), [i]);
    if (!box || box.width < 1 || box.height < 1 || box.width > 4000 || box.height > 4000) continue;
    const x = Math.floor(box.x), y = Math.floor(box.y);
    const clip = { x, y, width: Math.ceil(box.x + box.width) - x, height: Math.ceil(box.y + box.height) - y, scale: 1 };
    const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
    out[i] = `data:image/png;base64,${data}`;
  }
  await run(tabId, () => MirrorUIExtract.unisolate());
  return out;
}

// Cross-origin stylesheets the page can't read itself, fetched for their @font-face rules.
async function fetchSheets(urls) {
  const sheets = [];
  for (const url of urls) {
    try {
      const r = await fetch(url, { credentials: 'omit' });
      if (r.ok) sheets.push({ url, text: await r.text() });
    } catch { /* unreachable sheet: its fonts just won't be offered */ }
  }
  return sheets;
}

// ---------------------------------------------------------------- debugger sessions
// Pick/Clone captures, the Responsive tool's live preview and full-page screenshots all drive the tab through
// one chrome.debugger connection. A session stays attached while someone uses it or a live preview is on;
// after a capture the live preview size comes back.
const sessions = new Map(); // tabId -> {users, live: {width, height, mobile} | null}

async function attach(tabId) {
  let s = sessions.get(tabId);
  if (!s) {
    await chrome.debugger.attach({ tabId }, '1.3');
    s = { users: 0, live: null };
    sessions.set(tabId, s);
  }
  s.users++;
  return s;
}

async function release(tabId) {
  const s = sessions.get(tabId);
  if (!s) return;
  s.users--;
  if (s.users <= 0 && !s.live) {
    sessions.delete(tabId);
    await chrome.debugger.detach({ tabId }).catch(() => {});
  }
}

// the user can end the session from the browser's "is debugging this browser" bar
chrome.debugger.onDetach.addListener((source) => {
  if (!sessions.has(source.tabId)) return;
  sessions.delete(source.tabId);
  chrome.tabs.sendMessage(source.tabId, { type: 'debugger-detached' }).catch(() => {});
});

const cdp = (tabId) => (method, params = {}) => chrome.debugger.sendCommand({ tabId }, method, params);

// Lays the tab out at size {width, height, mobile}, or back at the window's own size for null.
async function emulate(tabId, size) {
  const send = cdp(tabId);
  if (!size) {
    await send('Emulation.clearDeviceMetricsOverride');
    await send('Emulation.setTouchEmulationEnabled', { enabled: false });
    await send('Emulation.setScrollbarsHidden', { hidden: false });
    return;
  }
  await send('Emulation.setDeviceMetricsOverride', {
    width: size.width, height: size.height, deviceScaleFactor: size.mobile ? 2 : 1, mobile: !!size.mobile,
  });
  await send('Emulation.setTouchEmulationEnabled', { enabled: !!size.mobile, maxTouchPoints: size.mobile ? 5 : 1 });
  // classic scrollbars would eat 15px of every emulated width
  await send('Emulation.setScrollbarsHidden', { hidden: true });
}

async function capture(tabId) {
  const { viewports } = await getOptions();
  const widths = [...viewports].sort((a, b) => a - b);
  const send = cdp(tabId);
  const captures = [], shots = {};
  const session = await attach(tabId);
  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['lib/extract.js'] });
    await run(tabId, () => MirrorUIExtract.freeze());
    for (const width of widths) {
      chrome.tabs.sendMessage(tabId, { type: 'capture-progress', width }).catch(() => {});
      await emulate(tabId, { width, height: VIEWPORT_HEIGHT, mobile: false });
      await sleep(500); // media queries, resize handlers and lazy layout settle
      await run(tabId, (sel) => {
        document.querySelector(sel).scrollIntoView({ block: 'start' });
        return document.fonts.ready.then(() => true);
      }, [TARGET]);
      await sleep(300);
      const data = await run(tabId, (sel) => MirrorUIExtract.extract(sel), [TARGET]);
      if (!data || data.error) throw new Error(data ? data.error : 'Could not read the element');
      if (width === widths[widths.length - 1]) {
        // hover and fonts don't depend on the width; the desktop pass collects them
        const { hover, ...states } = await statePass(send, tabId, data.root);
        data.hover = hover;
        data.states = states;
        data.fontSheets = await fetchSheets(data.fonts.sheets);
      }
      if (data.rect.width >= 1 && data.rect.height >= 1) {
        // fixed headers and cookie bars would otherwise land on top of the element in the screenshot
        await run(tabId, (sel) => MirrorUIExtract.hideOverlays(sel), [TARGET]);
        // whole-pixel clip, the same rounding the CLI uses for original and clone
        const x = Math.floor(data.rect.x), y = Math.floor(data.rect.y);
        const clip = { x, y, width: Math.ceil(data.rect.x + data.rect.width) - x,
          height: Math.ceil(data.rect.y + data.rect.height) - y, scale: 1 };
        const { data: png } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip });
        data.canvas = await canvasShots(send, tabId, data.root);
        await run(tabId, () => MirrorUIExtract.restoreOverlays());
        shots[width] = `data:image/png;base64,${png}`;
      } else {
        shots[width] = null; // hidden or display:contents at this width: nothing to photograph
      }
      captures.push(data);
    }
  } finally {
    await emulate(tabId, session.live).catch(() => {});
    await run(tabId, (sel) => {
      globalThis.MirrorUIExtract?.cleanup();
      document.querySelector(sel)?.removeAttribute('data-mirrorui-target');
    }, [TARGET]).catch(() => {});
    await release(tabId);
  }
  return { captures, shots };
}

// ---------------------------------------------------------------- screenshots

const png = (data) => `data:image/png;base64,${data}`;

// The whole document: the layout's content size, captured beyond the viewport (capped where Chrome's
// textures give out).
async function fullPage(tabId) {
  const send = cdp(tabId);
  const { cssContentSize: size } = await send('Page.getLayoutMetrics');
  const clip = { x: 0, y: 0, width: Math.ceil(size.width), height: Math.min(Math.ceil(size.height), 16000), scale: 1 };
  return png((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip })).data);
}

async function screenshot(tab, msg) {
  if (msg.mode === 'visible') return chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  await attach(tab.id);
  try {
    if (msg.mode === 'full') return await fullPage(tab.id);
    return png((await cdp(tab.id)('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...msg.clip, scale: 1 } })).data);
  } finally {
    await release(tab.id);
  }
}

// One screenshot per size for the Responsive tool; the tab returns to its live preview size (or its own) after.
async function sizeShots(tabId, sizes, full) {
  const session = await attach(tabId);
  const send = cdp(tabId);
  const out = [];
  try {
    for (const size of sizes) {
      await emulate(tabId, size);
      await sleep(700);
      const data = full ? await fullPage(tabId) : png((await send('Page.captureScreenshot', { format: 'png' })).data);
      out.push({ ...size, data });
    }
  } finally {
    await emulate(tabId, session.live).catch(() => {});
    await release(tabId);
  }
  return out;
}

async function saveJob(job) {
  const all = await chrome.storage.local.get(null);
  const old = Object.keys(all).filter((k) => k.startsWith('job:')).sort().slice(0, -(MAX_JOBS - 1));
  if (old.length) await chrome.storage.local.remove(old);
  await chrome.storage.local.set({ [`job:${job.id}`]: job });
}

// Captures the element Pick marked and stores the job; the toolbar reads it back from storage by id.
async function captureJob(tab, description) {
  // ids sort by time, so the oldest jobs are the first keys
  const id = Date.now().toString(36);
  const job = { id, url: tab.url, title: tab.title, description, created: Date.now() };
  try {
    Object.assign(job, await capture(tab.id));
  } catch (e) {
    job.error = String(e && e.message ? e.message : e);
  }
  await saveJob(job);
  return job;
}

// ---------------------------------------------------------------- Google Fonts (Swap font)

const CATALOG_URL = 'https://fonts.google.com/metadata/fonts';
const CATALOG_DAYS = 7;

// [{family, category, popularity, wght: [min, max] | null, weights: [400, 700…], italic, subsets}], most popular
// first; cached for a week.
async function fontCatalog() {
  const { gfCatalog } = await chrome.storage.local.get('gfCatalog');
  if (gfCatalog && Date.now() - gfCatalog.at < CATALOG_DAYS * 864e5) return gfCatalog.list;
  const text = await (await fetch(CATALOG_URL, { credentials: 'omit' })).text();
  const data = JSON.parse(text.slice(text.indexOf('{')));
  const list = data.familyMetadataList.map((f) => {
    const wght = (f.axes || []).find((a) => a.tag === 'wght');
    const keys = Object.keys(f.fonts || {});
    return {
      family: f.family, category: f.category, popularity: f.popularity || 9999,
      wght: wght ? [wght.min, wght.max] : null,
      weights: keys.filter((k) => !k.endsWith('i')).map(Number).filter(Boolean).sort((a, b) => a - b),
      italic: keys.some((k) => k.endsWith('i')),
      subsets: (f.subsets || []).filter((s) => s !== 'menu'),
    };
  }).sort((a, b) => a.popularity - b.popularity);
  await chrome.storage.local.set({ gfCatalog: { at: Date.now(), list } });
  return list;
}

// Font files for a css2 family spec ('Inter:wght@100..900', 'Lora:wght@400;700'), as base64 so the page can
// add them with the FontFace API: no <link> into the page, so its CSP can't block them. `text` asks for a
// tiny subset with just those characters (list previews); `subsets` drops the scripts the page doesn't use.
async function googleFont({ spec, text, subsets }) {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(spec).replace(/%20/g, '+')}`
    + `${text ? `&text=${encodeURIComponent(text)}` : ''}&display=swap`;
  const css = await (await fetch(url, { credentials: 'omit' })).text();
  const faces = [];
  for (const m of css.matchAll(/(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g)) {
    const [, subset, body] = m;
    if (subset && subsets && !subsets.includes(subset)) continue;
    const prop = (name) => (new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(body) || [])[1];
    const src = /url\(([^)]+)\)/.exec(prop('src') || '');
    if (!src) continue;
    const r = await fetch(src[1].replace(/['"]/g, ''), { credentials: 'omit' });
    if (!r.ok) continue;
    faces.push({ style: prop('font-style') || 'normal', weight: prop('font-weight') || '400',
      unicodeRange: prop('unicode-range') || undefined, data: toBase64(await r.arrayBuffer()) });
  }
  if (!faces.length) throw new Error(`Google Fonts has no files for ${spec}`);
  return faces;
}

const HANDLERS = {
  'font-catalog': async () => ({ list: await fontCatalog() }),
  'google-font': async (msg) => ({ faces: await googleFont(msg) }),
  capture: async (msg, sender) => {
    const job = await captureJob(sender.tab, msg.description);
    return { id: job.id, error: job.error };
  },
  'open-results': async (msg, sender) => {
    await chrome.tabs.create({ url: `results.html#${msg.id}`, index: sender.tab ? sender.tab.index + 1 : undefined });
    return { ok: true };
  },
  'fetch-fonts': async (msg) => ({ files: await fetchFonts(msg.urls || []) }),
  // images, videos and fonts for a project ZIP: {url: {base64, type}}; what fails or is too big is left out
  'fetch-assets': async (msg) => {
    const files = {};
    await Promise.all((msg.urls || []).map(async (url) => {
      try {
        const r = await fetch(url, { credentials: 'omit' });
        if (!r.ok || +r.headers.get('content-length') > MAX_ASSET) return;
        const buffer = await r.arrayBuffer();
        if (buffer.byteLength <= MAX_ASSET) files[url] = { base64: toBase64(buffer), type: r.headers.get('content-type') || '' };
      } catch { /* stays a link to the original */ }
    }));
    return { files };
  },
  'fetch-text': async (msg) => {
    try {
      const r = await fetch(msg.url, { credentials: 'omit' });
      return r.ok ? { text: await r.text() } : { error: `HTTP ${r.status}` };
    } catch (e) {
      return { error: String(e.message || e) };
    }
  },
  // Responsive: show the tab at a size until reset (or the debugger bar is dismissed)
  emulate: async (msg, sender) => {
    const tabId = sender.tab.id;
    const s = sessions.get(tabId);
    if (!s || !s.live) {
      const session = await attach(tabId);
      session.users--; // the live preview, not a user, keeps it attached
      session.live = msg.size;
    } else s.live = msg.size;
    await emulate(tabId, msg.size);
    return { ok: true };
  },
  'emulate-reset': async (msg, sender) => {
    const tabId = sender.tab.id;
    const s = sessions.get(tabId);
    if (!s || !s.live) return { ok: true };
    s.live = null;
    await emulate(tabId, null).catch(() => {});
    s.users++;
    await release(tabId);
    return { ok: true };
  },
  screenshot: async (msg, sender) => ({ data: await screenshot(sender.tab, msg) }),
  shots: async (msg, sender) => ({ shots: await sizeShots(sender.tab.id, msg.sizes, msg.full) }),
  download: async (msg) => {
    try {
      await chrome.downloads.download({ url: msg.url, filename: msg.filename || undefined, conflictAction: 'uniquify' });
      return { ok: true };
    } catch (e) {
      return { error: String(e.message || e) };
    }
  },
};

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const handler = HANDLERS[msg && msg.type];
  if (!handler) return false;
  handler(msg, sender).then(reply, (e) => reply({ error: String(e.message || e) }));
  return true; // reply is async
});

const toggleActive = async (tab) => {
  try {
    await toggleToolbar(tab.id);
  } catch {
    // browser pages (chrome://, the extension store) don't accept content scripts
    await chrome.action.setBadgeBackgroundColor({ color: '#c0392b', tabId: tab.id });
    await chrome.action.setBadgeText({ text: '×', tabId: tab.id });
    setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }), 2500);
  }
};

chrome.action.onClicked.addListener(toggleActive);
chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) toggleActive(tab);
});
