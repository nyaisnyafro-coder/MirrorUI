// Packs a build into the files of an Astro project, plus a standalone preview, with the images, videos and
// fonts the clone loads saved next to it instead of hotlinked from the original site:
//   index.html                       standalone preview: self-contained (fonts embedded, images from the
//                                    original site), so it opens even straight from inside the ZIP
//   src/components/<Name>.astro      the component; for a page, its sections in src/components/<name>/
//   src/styles/mirrorui/<slug>.css   @font-face rules and @theme tokens, imported after Tailwind
//   public/clone-assets/<slug>/…     the assets; the code refers to them as /clone-assets/<slug>/…
//   README.md                        how to use it, and anything that couldn't be downloaded
//
//   MirrorUIPackage.urls(built) -> [url]   the http(s) URLs to fetch
//   MirrorUIPackage.files(built, fetched, {slug}) -> [{name, data}]
//       fetched: {url: {base64, type}} for the URLs that could be downloaded
globalThis.MirrorUIPackage = (() => {
  const DIR = 'clone-assets';
  const INLINE_MAX = 4096; // smaller data: URLs (icons, tiny SVG patterns) stay inline
  const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/avif': 'avif',
    'image/svg+xml': 'svg', 'image/x-icon': 'ico', 'video/mp4': 'mp4', 'video/webm': 'webm', 'audio/mpeg': 'mp3',
    'font/woff2': 'woff2', 'font/woff': 'woff', 'font/ttf': 'ttf', 'font/otf': 'otf', 'application/font-woff': 'woff' };

  // The text forms a URL takes in the generated code: as written, with underscores escaped inside Tailwind
  // classes (bg-[url('…/a\_b.png')]), that escape again in the Astro frontmatter's JSON, and &-escaped in
  // HTML attributes.
  const forms = (url) => {
    const out = new Set([url, url.replace(/_/g, '\\_'), url.replace(/_/g, '\\\\_')]);
    for (const f of [...out]) out.add(f.replace(/&/g, '&amp;'));
    return [...out];
  };
  const plain = (raw) => raw.replace(/&amp;/g, '&').replace(/\\\\_/g, '_').replace(/\\_/g, '_');

  // Every asset URL in the text: src, poster and srcset attributes, url() in classes and CSS.
  const found = (text) => {
    const out = [];
    for (const m of text.matchAll(/\b(?:src|poster)="([^"]+)"/g)) out.push(m[1]);
    for (const m of text.matchAll(/\bsrcset="([^"]+)"/g)) {
      for (const part of m[1].split(/,\s+/)) out.push(part.trim().split(/\s+/)[0]);
    }
    for (const m of text.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) out.push(m[2]);
    return out.map(plain);
  };

  const isRemote = (u) => /^https?:\/\//.test(u);
  const isBigData = (u) => u.startsWith('data:') && u.length > INLINE_MAX && /;base64,/.test(u);
  const TAILWIND = /^https:\/\/cdn\.jsdelivr\.net\/npm\/@tailwindcss\//;

  const assetUrls = (built) => [...new Set(found(built.doc).filter((u) => (isRemote(u) && !TAILWIND.test(u)) || isBigData(u)))];

  const urls = (built) => assetUrls(built).filter(isRemote);

  const base64Bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  // a file name that needs no escaping anywhere: lowercase letters, digits, - and .
  const fileName = (url, type, taken, n) => {
    let stem = 'asset', ext = EXT[type] || '';
    if (isRemote(url)) {
      const last = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
      const m = /^(.*?)(?:\.([a-z0-9]{2,5}))?$/i.exec(last);
      stem = m[1] || stem;
      ext = (m[2] || ext).toLowerCase();
    } else stem = type.startsWith('font/') ? 'font' : type.startsWith('image/') ? 'image' : 'asset';
    stem = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || `asset-${n}`;
    let name = ext ? `${stem}.${ext}` : stem;
    for (let k = 2; taken.has(name); k++) name = ext ? `${stem}-${k}.${ext}` : `${stem}-${k}`;
    taken.add(name);
    return name;
  };

  const replaceAll = (text, map, prefix) => {
    // longest first, so a URL that's a prefix of another doesn't break it
    for (const [url, name] of [...map].sort((a, b) => b[0].length - a[0].length)) {
      for (const f of forms(url)) text = text.split(f).join(prefix + name);
    }
    return text;
  };

  const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const readme = (main, slug, missing) => `# ${main}

Cloned with MirrorUI. Open \`index.html\` to see it on its own (it needs an internet connection: Tailwind
and the images load from the web).

## In an Astro project

1. Copy \`src/\` and \`public/\` into your project (or use "Save to project" in MirrorUI, which does all of this).
2. Tailwind CSS v4 has to be set up (\`npx astro add tailwind\`). In the stylesheet that has
   \`@import "tailwindcss";\` (usually \`src/styles/global.css\`), add below it:

   \`\`\`css
   @import "./mirrorui/${slug}.css";
   \`\`\`
3. Use the component:

   \`\`\`astro
   ---
   import ${main} from '../components/${main}.astro';
   ---
   <${main} />
   \`\`\`

Images, videos and fonts are in \`public/${DIR}/${slug}/\`. Only use assets and fonts you have the rights to.
The theme's color and font names (accent, ink, tone-95…) are shared by every clone; a later clone's theme file
overrides an earlier one's values.
${missing.length ? `\n## Not downloaded\n\nThese still load from the original site:\n\n${missing.map((u) => `- ${u}`).join('\n')}\n` : ''}`;

  // [{name, data}] for the project (and the standalone preview and README, which a ZIP gets too).
  // slug names the clone's asset folder and theme file, so several clones can live in one project.
  const files = (built, fetched = {}, { slug = null } = {}) => {
    const comps = [...(built.components || [{ name: built.astroName, path: `${built.astroName}.astro`, code: built.astro }])];
    slug = kebab(slug || comps[0].name) || 'clone';
    const dir = `${DIR}/${slug}`;
    // a picked component without a better name is named after the clone, so several can sit side by side
    if (comps[0].name === 'Component') {
      const name = slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('');
      comps[0] = { ...comps[0], name: /^[A-Z]/.test(name) ? name : `Clone${name}`, path: `${/^[A-Z]/.test(name) ? name : `Clone${name}`}.astro` };
    }
    const map = new Map(), taken = new Set(), assets = [], missing = [];
    assetUrls(built).forEach((url, n) => {
      let bytes, type;
      if (isRemote(url)) {
        if (!fetched[url]) { missing.push(url); return; }
        bytes = base64Bytes(fetched[url].base64);
        type = (fetched[url].type || '').split(';')[0].trim();
      } else {
        const m = /^data:([^;,]+)[^,]*;base64,(.*)$/.exec(url);
        if (!m) return;
        type = m[1];
        bytes = base64Bytes(m[2]);
      }
      const name = fileName(url, type, taken, n + 1);
      map.set(url, name);
      assets.push({ name: `public/${dir}/${name}`, data: bytes });
    });
    // the project's own stylesheet imports Tailwind; this file only adds the clone's fonts and tokens
    const theme = built.themeFile.replace(/^@import "tailwindcss";\s*/, '');
    return [
      // not pointed at public/: opened from inside the ZIP (Windows extracts just that one file) those
      // relative paths lead nowhere; fonts and canvas pictures are already embedded in it
      { name: 'index.html', data: built.doc },
      ...comps.map((c) => ({ name: `src/components/${c.path}`, data: replaceAll(c.code, map, `/${dir}/`) })),
      { name: `src/styles/mirrorui/${slug}.css`, data: replaceAll(theme, map, `/${dir}/`) },
      ...assets,
      { name: 'README.md', data: readme(comps[0].name, slug, missing) },
    ];
  };

  // what a clone is called in a project: the page or component name, or the site for an unnamed component
  const slugFor = (built, hostname) => (built.astroName === 'Component' ? (hostname || '').replace(/^www\./, '') || 'clone' : built.astroName);

  return { urls, files, kebab, slugFor, DIR };
})();
