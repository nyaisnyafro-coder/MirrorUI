// Full-size results page ("Open full view" in the Pick panel): compiles the stored capture with
// lib/compile.js, shows original vs clone at each captured width (lib/stage.js), and offers the
// Astro / HTML / theme.css output.
const $ = (id) => document.getElementById(id);
const TAILWIND_LOCAL = 'vendor/tailwindcss-browser.js';

let job = null;
let built = null;
let previewDoc = '';
let width = 0;
let tab = 'astro';

let part = 0;

const files = () => ({
  astro: [built.components[part].path.split('/').pop(), built.components[part].code, 'text/plain'],
  html: ['index.html', built.doc, 'text/html'],
  theme: ['theme.css', built.themeFile, 'text/css'],
});

const toDataUrl = (blob, type) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(type ? new Blob([blob], { type }) : blob);
});

// The page's font files as data: URLs, so the clone renders with them anywhere (no CORS, no hotlinking).
// all of the page's fonts, or (all: false) its icon fonts only, which a clone always needs
async function fontFiles(captures, all) {
  const urls = [...new Set(MirrorUICompile.neededFaces(captures, all).flatMap((f) => f.urls))];
  const out = {};
  await Promise.all(urls.map(async (url) => {
    try {
      const r = await fetch(url, { credentials: 'omit' });
      const ext = url.split('?')[0].split('.').pop().toLowerCase();
      if (r.ok) out[url] = await toDataUrl(await r.blob(), MirrorUICompile.FONT_TYPES[ext] || 'font/woff2');
    } catch { /* that face falls back to the next font in the stack */ }
  }));
  return out;
}

async function rebuild() {
  const fonts = $('fonts').checked;
  const options = { sourceUrl: job.url, fonts, fontFiles: await fontFiles(job.captures, fonts) };
  built = MirrorUICompile.build(job.captures, options);
  previewDoc = MirrorUICompile.build(job.captures, { ...options, tailwindSrc: TAILWIND_LOCAL, preview: true }).doc;
  showCode();
  showCompare();
}

function showCode() {
  // a cloned page comes as a page component plus one per section
  part = Math.min(part, built.components.length - 1);
  $('part').hidden = tab !== 'astro' || built.components.length < 2;
  $('part').replaceChildren(...built.components.map((c, i) => new Option(c.path, String(i), false, i === part)));
  $('code').textContent = files()[tab][1];
  for (const b of $('tabs').querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.tab === tab));
}

let stage = null;

function showCompare() {
  const capture = job.captures.find((c) => c.vw === width);
  for (const b of $('widths').querySelectorAll('button')) b.setAttribute('aria-pressed', String(+b.dataset.width === width));
  stage?.dispose();
  stage = MirrorUIStage.show($('original-stage'), $('clone-stage'), { capture, shot: job.shots[width], doc: previewDoc });
}

window.addEventListener('resize', () => stage?.layout());

$('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  tab = b.dataset.tab;
  showCode();
});
$('widths').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  width = +b.dataset.width;
  showCompare();
});
$('fonts').addEventListener('change', async () => {
  // remembered, like the setting in the result window
  const { options = {} } = await chrome.storage.local.get('options');
  await chrome.storage.local.set({ options: { ...options, embedFonts: $('fonts').checked } });
  await rebuild();
});
$('part').addEventListener('change', () => { part = +$('part').value; showCode(); });
$('copy').addEventListener('click', async () => {
  await navigator.clipboard.writeText(files()[tab][1]);
  $('copy').textContent = 'Copied';
  setTimeout(() => { $('copy').textContent = 'Copy'; }, 1200);
});
$('download').addEventListener('click', () => {
  const [name, text, type] = files()[tab];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

// ---------------------------------------------------------------- ZIP and save to project

const slug = () => MirrorUIPackage.slugFor(built, new URL(job.url).hostname);

// The project files with the images, videos and fonts downloaded (by the service worker, like the toolbar's).
async function projectFiles() {
  const urls = MirrorUIPackage.urls(built);
  const fetched = urls.length ? ((await chrome.runtime.sendMessage({ type: 'fetch-assets', urls })).files || {}) : {};
  return { files: MirrorUIPackage.files(built, fetched, { slug: slug() }), missing: urls.filter((u) => !fetched[u]) };
}

async function busy(button, label, work) {
  const text = button.textContent;
  button.disabled = true;
  button.textContent = label;
  try { await work(); } finally { button.disabled = false; button.textContent = text; }
}

$('zip').addEventListener('click', () => busy($('zip'), 'Packing…', async () => {
  const { files } = await projectFiles();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(MirrorUIZip(files));
  a.download = `${slug()}.zip`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}));

// The project folder is remembered (its handle, in this extension's own IndexedDB), so the next save goes
// to the same place; the browser asks for write access again in a new session.
const handles = (mode, fn) => new Promise((resolve, reject) => {
  const open = indexedDB.open('mirrorui', 1);
  open.onupgradeneeded = () => open.result.createObjectStore('handles');
  open.onerror = () => reject(open.error);
  open.onsuccess = () => {
    const req = fn(open.result.transaction('handles', mode).objectStore('handles'));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  };
});
const savedFolder = () => handles('readonly', (s) => s.get('project')).catch(() => null);
const rememberFolder = (dir) => handles('readwrite', (s) => s.put(dir, 'project')).catch(() => {});

const fileAt = async (root, path, create) => {
  const parts = path.split('/');
  let dir = root;
  for (const p of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(p, { create });
  return dir.getFileHandle(parts[parts.length - 1], { create });
};
const readText = async (root, path) => {
  try { return await (await (await fileAt(root, path, false)).getFile()).text(); } catch { return null; }
};
const exists = (root, path) => fileAt(root, path, false).then(() => true, () => false);
const writeFile = async (root, path, data) => {
  const w = await (await fileAt(root, path, true)).createWritable();
  await w.write(data);
  await w.close();
};

async function chooseFolder() {
  try {
    const dir = await showDirectoryPicker({ id: 'mirrorui-project', mode: 'readwrite' });
    await rememberFolder(dir);
    return dir;
  } catch {
    return null; // cancelled
  }
}

async function projectFolder() {
  const dir = await savedFolder();
  if (dir && (await dir.requestPermission({ mode: 'readwrite' })) === 'granted') return dir;
  return chooseFolder();
}

const STYLESHEETS = ['src/styles/global.css', 'src/styles/globals.css', 'src/styles/main.css', 'src/styles/app.css', 'src/styles/tailwind.css'];

async function saveTo(dir) {
  const pkg = await readText(dir, 'package.json');
  if (!pkg || !/"astro"\s*:/.test(pkg)) {
    if (!confirm(`"${dir.name}" doesn't look like an Astro project (no astro in its package.json). Save into it anyway?`)) return;
  }
  const { files: all, missing } = await projectFiles();
  const files = all.filter((f) => /^(src|public)\//.test(f.name));
  const theme = files.find((f) => f.name.startsWith('src/styles/mirrorui/'));
  const importLine = `@import "./mirrorui/${theme.name.split('/').pop()}";`;
  // the stylesheet that imports Tailwind gets the clone's theme imported right below
  let sheet = null;
  for (const path of STYLESHEETS) {
    const text = await readText(dir, path);
    if (text !== null && /@import\s+["']tailwindcss["']/.test(text)) { sheet = { path, text }; break; }
  }
  const addImport = sheet && !sheet.text.includes(importLine);
  const replaced = [];
  for (const f of files) if (await exists(dir, f.name)) replaced.push(f.name);
  if (replaced.length || addImport) {
    const lines = [];
    if (replaced.length) lines.push(`These files in "${dir.name}" will be replaced:\n${replaced.join('\n')}`);
    if (addImport) lines.push(`This line will be added to ${sheet.path}:\n${importLine}`);
    if (!confirm(`${lines.join('\n\n')}\n\nContinue?`)) return;
  }
  for (const f of files) await writeFile(dir, f.name, f.data);
  if (addImport) await writeFile(dir, sheet.path, sheet.text.replace(/(@import\s+["']tailwindcss["'][^;]*;)/, `$1\n${importLine}`));
  showSaved(dir, files, sheet, importLine, missing);
}

function showSaved(dir, files, sheet, importLine, missing) {
  const main = files.find((f) => f.name.startsWith('src/components/') && f.name.split('/').length === 3).name.split('/').pop().replace('.astro', '');
  const box = $('saved');
  const h = (tag, text) => { const e = document.createElement(tag); if (text) e.textContent = text; return e; };
  const list = h('ul');
  list.append(...files.map((f) => h('li', f.name)));
  box.replaceChildren(h('h3', `Saved ${files.length} files to "${dir.name}"`), list);
  box.append(h('p', sheet ? `${sheet.path} imports the clone's theme.`
    : `Add this below @import "tailwindcss"; in your global stylesheet: ${importLine}`));
  box.append(h('p', 'Use it in a page:'), h('pre', `---\nimport ${main} from '../components/${main}.astro';\n---\n<${main} />`));
  if (missing.length) box.append(h('p', `${missing.length} asset(s) couldn't be downloaded and still load from the original site.`));
  box.classList.toggle('warn', missing.length > 0);
  box.hidden = false;
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const showFolder = (dir) => {
  $('save').textContent = dir ? `Save to ${dir.name}` : 'Save to project';
  $('folder').hidden = !dir;
};

$('save').addEventListener('click', () => busy($('save'), 'Saving…', async () => {
  const dir = await projectFolder();
  if (dir) await saveTo(dir);
}).then(async () => showFolder(await savedFolder())));
$('folder').addEventListener('click', () => busy($('folder'), 'Choosing…', async () => {
  const dir = await chooseFolder();
  if (dir) await saveTo(dir);
}).then(async () => showFolder(await savedFolder())));
savedFolder().then(showFolder);

async function init() {
  const key = `job:${location.hash.slice(1)}`;
  job = (await chrome.storage.local.get(key))[key];
  if (!job) {
    $('what').textContent = 'Clone not found';
    $('error').hidden = false;
    $('error').textContent = 'This clone is no longer stored. MirrorUI keeps the last few.';
    $('compare-section').hidden = $('code-section').hidden = true;
    return;
  }
  document.title = `${job.description || job.title} · MirrorUI`;
  $('what').textContent = job.description || job.title;
  $('url').textContent = job.url;
  $('url').href = job.url;
  if (job.error) {
    $('error').hidden = false;
    $('error').textContent = `Capture failed: ${job.error}`;
    $('compare-section').hidden = $('code-section').hidden = true;
    return;
  }
  const widths = job.captures.map((c) => c.vw).sort((a, b) => a - b);
  width = widths[widths.length - 1];
  $('widths').replaceChildren(...widths.map((w) => {
    const b = document.createElement('button');
    b.className = 'btn';
    b.dataset.width = String(w);
    b.textContent = `${w}px`;
    return b;
  }));
  const { options = {} } = await chrome.storage.local.get('options');
  $('fonts').checked = options.embedFonts === true; // off unless turned on: most fonts are licensed
  await rebuild();
}

init();
