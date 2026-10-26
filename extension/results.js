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

const files = () => ({
  astro: [`${built.astroName}.astro`, built.astro, 'text/plain'],
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
async function fontFiles(captures) {
  const urls = [...new Set(MirrorUICompile.fontFaces(captures).flatMap((f) => f.urls))];
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
  const options = { sourceUrl: job.url, fonts, fontFiles: fonts ? await fontFiles(job.captures) : {} };
  built = MirrorUICompile.build(job.captures, options);
  previewDoc = MirrorUICompile.build(job.captures, { ...options, tailwindSrc: TAILWIND_LOCAL, preview: true }).doc;
  showCode();
  showCompare();
}

function showCode() {
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
$('fonts').addEventListener('change', rebuild);
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
  await rebuild();
}

init();
