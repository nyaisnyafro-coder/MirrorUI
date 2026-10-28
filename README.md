# MirrorUI

Captures a single component on a web page (its DOM and computed CSS) and turns it into responsive **Tailwind v4 HTML** and an **Astro component**. No LLM involved. It works in two ways:

- **Browser extension (Chrome / Opera / Edge):** click a component on the page and the result opens in a new tab. No server needed.
- **Command line (Python):** give it a URL and a selector; it compares the result with the original pixel by pixel.

Both run the same code (`extension/lib/`) and produce the same output for the same page.

## Browser extension

**Install (once):**
1. Download `mirrorui-<version>.zip` from the [Releases](../../releases/latest) page and **unzip** it into a folder (it can't be loaded from inside the ZIP). If you're installing from source, use the repo's `extension` folder instead.
2. Open the browser's extensions page: `chrome://extensions`, `edge://extensions` or `opera://extensions`.
3. Turn on **Developer mode** (top right in Chrome).
4. Click **Load unpacked** and choose the unzipped folder (the one containing `manifest.json`).

Because it isn't installed from a store, the browser may warn about extensions in developer mode; that's expected. Don't delete or move the folder: the extension runs from there.

**Update:** unzip the new version's ZIP over the same folder, click the reload button on the MirrorUI card on the extensions page, and reload open tabs.

**Use:** click the extension icon or press `Alt+Shift+M`. A toolbar opens at the bottom of the page; each tool shows its result in the panel on the right. The same icon or shortcut closes the toolbar; `–` minimizes it, `Esc` ends the active mode.

| Tool | What it does |
|---|---|
| **Pick** | Hover over a component and click (`↑` parent, `↓` child). The component is captured at 375 / 768 / 1280 px and the result opens in a large window: Astro / HTML / theme.css code on top, a preview below. The preview switches between **Clone**, **Original** and **Side by side**, shown at **Fit** or **100%**. Drag the line between the two parts to resize the code area. **Download ZIP** downloads a folder you can copy straight into an Astro project (component, theme, images, videos, and fonts if embedded; see *Using it in your Astro site*). **Save to project** writes the result directly into your project; **Full view** opens it in a separate tab. The widths can be changed in the Pick panel. |
| **Inspect** | Hover to see size, font, colour and padding/margin (padding in green). Click to open the box model and styles in the panel, with **Copy CSS**, **Tailwind** (turns the element into Tailwind classes and HTML) and **Parent** buttons. With an element selected, hold `Alt` and hover another element to measure the distance between them. |
| **Colors** | Every colour used on the page, most used first. Filter by background, text, border and accent colours. Click a colour to highlight where it's used. Export as CSS variables, a Tailwind `@theme` or JSON. **Pick** adds any colour on screen with an eyedropper. |
| **Fonts** | The font families the text actually uses: web font or system font, weights, sizes and a live sample. Buttons: **Copy stack**, **Copy @font-face** and **Highlight** (marks the text set in that font). |
| **Assets** | Images, inline SVGs (with sprites copied in), CSS background images, videos and icons. Filter by type, copy the URL or SVG, download one by one or a selection. |
| **Clone page** | Clones the whole page like Pick: one Tailwind HTML document and an Astro page component. The page is split into sections: each `header`, `section`, `footer` and so on becomes its own component (`Header.astro`, `Hero.astro`, `Footer.astro`…), imported by the page component. Browse them in the file list of the code area. Canvas/WebGL drawings come across as images; videos and JavaScript animations can't be cloned. Scroll down the page first so lazy-loaded content is there. |
| **Design MD** | The page's measured design system: colour tokens, font families, type scale (role, size, line height, weight), spacing scale and base unit, radius, shadows, breakpoints, container widths, transition durations and button styles. **Visual** and **Markdown** views. Download it as `DESIGN.md`, or as `SKILL.md` for coding agents (in Claude Code: `.claude/skills/<name>/SKILL.md`). |
| **Responsive** | Shows the tab in place at a device size: phone, tablet, laptop, desktop or a custom size. Phones and tablets also emulate a touch screen and 2× pixel density. **Capture all sizes** takes a screenshot at every size, full page if you like. **Own size**, or closing the tool, returns the tab to its own size. |
| **Capture** | Screenshots: the visible area, the full page, a single element or a region you drag out. The panel shows a preview with **Download** and **Copy** (as an image to the clipboard). The toolbar is left out of the shot. |
| **Swap font** | Try any of about 1950 families from the Google Fonts catalogue live on the page, for all text, headings only or body text only. Search fonts by name and filter by category; each card previews in its own font. You can also use a font installed on your computer by name. Icon fonts and code blocks (`monospace`) don't change. **Undo** steps back, **Revert** returns to the original fonts, and the copy button gives the choice as a Google Fonts `<link>` + CSS + Tailwind `@theme`. Pick and Clone page capture the swapped font under its real name (e.g. `font-lora`); add that font from Google Fonts to the project where you use the clone. |
| **Arrange** | Click an element to delete it; drag it to move it before or after another element (a green line shows where it will land). `↑`/`↓` moves to the parent or child, `Delete` removes the hovered element, `Ctrl/⌘+Z` undoes each step. The panel lists the changes; **Reset all** undoes them all. Pick and Clone page capture the page as you've arranged it. |
| **Edit text** | Click any text on the page and type over it. `Enter`/`Esc` finishes, `Shift+Enter` adds a line break, `Ctrl/⌘+Z` undoes the last change. In the panel each change can be undone on its own, and all of them copied as JSON. Changes last until the page is reloaded; Pick and Clone page capture the edited text, so you can try new copy before cloning. |

While Pick and Clone page capture, Responsive shows a size or Capture takes a full page, the browser shows a bar saying an extension is debugging this browser. That's expected: width emulation goes through the DevTools protocol. **Cancel** on that bar also ends the Responsive preview. The last 8 clones are kept.

Panels and the result window can be dragged by their title bars. Where you drop them is remembered across pages; double-click a title bar to return it to its default place. While Responsive shows a device size, the panel shrinks to a one-line strip so the page stays visible. **Devices** opens the device list again.

Changes from Edit text, Swap font and Arrange stay on the page after the toolbar is closed; reloading the page brings back the original.

On narrow screens (or while Responsive shows a phone size) the toolbar shows icons only; tool names appear on hover. The panel becomes a sheet that opens from the bottom.

The extension reads the tab you have open: it doesn't send new requests to the site, so it works on pages you're signed in to. It can't open on `chrome://` pages or the extension store; the icon shows a red `×` there.


## Command line setup (once)

Run the commands from the folder you want the project in (PowerShell):

```powershell
git clone https://github.com/nyaisnyafro-coder/MirrorUI.git
cd MirrorUI
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
.venv\Scripts\python -m playwright install chromium
```

## Cloning from the command line

```powershell
.venv\Scripts\python -m mirrorui "https://example.com/page" ".hero" -o out\hero
```

- **Finding a selector:** right-click the component in the browser → *Inspect*. Use the class of the component's root element (`.hero`, `.pricing`); if that doesn't work, right-click it in the Elements panel → *Copy → Copy selector*. If several elements match, the first one is used.
- **Options:**
  - `--viewports 375,768,1280`: the widths to capture. The smallest becomes the base classes; the next ones get the `md:` and `lg:` prefixes in order.
  - `--no-cache`: fetches the page again. Normally the same URL + selector comes from the cache.
  - `--no-verify`: skips the comparison step.
  - `--fonts`: embeds the page's own font files in the output (see Fonts).

For each viewport the command prints the share of pixels that differ between the original and the clone. 0–1% means identical. 2–7% is usually a font difference; try again with `--fonts`. For anything higher, open `out/<name>/original-*.png` and `clone-*.png` side by side.

## What gets captured

- Layout, spacing, typography, colours, borders, shadows: at 3 widths, with `md:` / `lg:` prefixes.
- `::before` / `::after` → `before:` / `after:` classes (content included).
- `:hover` states → `hover:`, and `group-hover:` for children. Nested groups use named groups (`group/card`).
- `:focus`, `:focus-visible` and `:active` states → `focus:`, `focus-visible:`, `active:` (on the element itself). The browser's own focus ring is left out.
- Transitions of elements that change state (`transition-colors duration-200`).
- Transforms: as `translate`, `rotate` and `scale` classes (`-translate-x-1/2`, `rotate-6`, `hover:scale-110`); others such as skew as `[transform:…]`.
- Shadows (`shadow-[…]`, including inset and multiple shadows) and `outline`.
- Canvas and WebGL drawings become an `<img>` of what they show at that moment; if they differ by width, a `<picture>` gives each width its own image.
- Colour, thickness and offset of link underlines.
- SVG sprites on the page (`<use href="#icon">`) are copied into the component.

## Output (`out/<name>/`)

| File | Purpose |
|---|---|
| `<Name>.astro` | The Astro component. Blocks repeated 3+ times become a `.map` loop, with the parts that change as props. Headings, paragraphs, link and button text, link addresses and images are props too |
| `<name>/<Section>.astro` | When the whole page (`body`) is cloned: each section as its own component (`Header`, `Hero`, `Footer`…) |
| `theme.css` | Colour and font tokens (`@theme`) |
| `index.html` | Standalone preview. Opens directly in the browser, loads Tailwind from a CDN |
| `original-*.png`, `clone-*.png` | Comparison screenshots |

## Using it in your Astro site

**Quickest (extension):** in the result window click **Save to project** → choose your project's folder in the tab that opens. It writes:
- `src/components/<Name>.astro` (for a page clone, the sections go in `src/components/<name>/`),
- `src/styles/mirrorui/<name>.css` (theme tokens and embedded fonts),
- `public/clone-assets/<name>/` (images, videos, fonts, canvas pictures; the code uses them from `/clone-assets/<name>/…`),
- and adds `@import "./mirrorui/<name>.css";` below the `@import "tailwindcss";` line in `src/styles/global.css`.

It asks before overwriting an existing file or changing `global.css`. The folder you chose is remembered; **Change folder** saves to another project. **Download ZIP** gives the same files as a ZIP (with a `README.md` explaining how to use them and an `index.html` that opens on its own).

To set it up by hand (or for the command-line output):

**1. Install Tailwind v4** (if the project doesn't have it):

```bash
npm i tailwindcss @tailwindcss/vite
```

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({ vite: { plugins: [tailwindcss()] } });
```

**2. Add the tokens to your global CSS.**
- `src/styles/global.css` should contain the `@import "tailwindcss";` line exactly once.
- Paste the `@theme { ... }` block from `theme.css` below it. If you embedded fonts, take the `@font-face` rules above it too.
- If you cloned several components, merge their `@theme` blocks. If tokens with the same name clash (two different `accent`s, say), rename one.
- Import this CSS file once in your layout.

**3. Copy the component and use it:**

```
out/hero/Hero.astro  →  src/components/Hero.astro
```

```astro
---
import Hero from '../components/Hero.astro';
---
<Hero />
```

Without props it renders the captured content. To pass your own, see the `interface` at the top of the component:

```astro
<Wrap cards={[
  { title: 'Websites', description: 'Fast, accessible sites.' },
  { title: 'Brand identity', description: 'Consistent type and colour.' },
]} />
```

**4. Make it yours.**
- Links (`href`) point to the original site; replace them with your own addresses.
- Headings, paragraphs, link/button text, link addresses and images are props (`title`, `heading`, `text`, `label`, `href`, `image`…), defaulting to the captured content. Change them like `<Hero title="New heading" href="/signup" />`. Text with other elements inside it (an `<em>` inside an `<h1>`, say) is written into the component as is.
- The component doesn't carry its outer spacing (page margins, background colour); the container on your page provides that.
  - To see the original's values, look at the classes on `#mirrorui-frame` in `index.html`.

## Fonts

Font files are not copied by default. `theme.css` names the page's font with fallbacks (`--font-helveticanow: helveticaNow, "Helvetica Neue", ...`); if your computer or project doesn't have that font, the browser uses the fallbacks, so the clone can look slightly different from the original. Most web fonts are commercially licensed, and a licence to use a font on one site doesn't let you copy it to another.

Icon fonts (such as fontello, Font Awesome, Material Icons: fonts whose characters sit in Unicode's private use area) are always included: without them the icons turn into empty boxes. Check their licence too before you publish a clone that uses them.

**Only if you have the right to use the font** (your own site, a font you've licensed for this use, or an open licence such as the SIL Open Font License), use `--fonts` on the CLI or tick **Embed original fonts** in the extension (the choice is remembered):
- The `@font-face` rules of the families the component uses are added to `theme.css`.
- The font files are embedded as data URLs, so the clone looks the same everywhere, independent of the original server and without CORS problems.
- Example: on a form using a commercial font the difference dropped from 2–7% to 1–3%.

## HTTP API (optional)

```bash
.venv/Scripts/python -m uvicorn server:app --port 8000
```

```bash
curl -X POST localhost:8000/clone -H "content-type: application/json" -d "{\"url\": \"https://example.com\", \"selector\": \".hero\"}"
```

Add `"fonts": true` to the request body to embed fonts. The response contains the HTML, the Astro source, the theme and the comparison results. Requests to the same domain run one after another, with at most 2 jobs running at once overall.

## Project layout

| Path | Contents |
|---|---|
| `extension/lib/extract.js` | Runs in the page: reads the DOM and styles, works out hover differences |
| `extension/lib/compile.js` | Turns a capture into Tailwind HTML + Astro |
| `extension/lib/stage.js` | Comparison view showing the original and the clone side by side (panel and full page) |
| `extension/lib/package.js`, `zip.js` | Turns the result into Astro project files (images under `public/`) and a ZIP |
| `extension/toolbar/` | The in-page toolbar: the shell (`ui.js`) and one file per tool |
| `extension/` | Service worker (capture, downloads), full-page result view, preview sandbox |
| `mirrorui/` | CLI and API: captures with Playwright, runs the same `extension/lib` files, compares |
| `tests/` | Tests (see Tests) |
| `scripts/` | Extension packaging and store images |
| `PRIVACY.md`, `STORE.md`, `store/` | Privacy policy, store listing texts, store images |

## Tests

```powershell
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m pytest                 # regression pages + extension (~2 min, offline)
.venv\Scripts\python -m pytest -m sites        # recorded real sites
```

- `tests/cases/`: a small page for every bug found so far. Each must clone pixel for pixel (under 0.5% difference) at every width and contain the classes the fix produces.
- `tests/test_extension.py`: loads the extension into Chromium and uses it like a person would: toolbar, Pick, Clone page, ZIP, Save to project, Edit text.
- `tests/test_sites.py`: recordings of real sites replayed offline with the clock frozen, so every run gives the same result. Which sites to test and their limits live in `tests/sites.json`. That list and the recordings (`tests/sites/*.har.zip`) concern other people's content, so they stay out of git, on your machine only. `tests/sites.example.json` shows the format: copy it, list your sites and record them once with `.venv\Scripts\python tests\record_sites.py`. Without the list these tests are skipped.

## Packaging the extension

```powershell
.venv\Scripts\python scripts\package_extension.py   # dist\mirrorui-<version>.zip
.venv\Scripts\python scripts\store_images.py        # screenshots and promo images under store\
```

Packaging checks that every file the manifest mentions exists, the icon sizes, and that no remote code is loaded. Releases are built by GitHub Actions when a `v*` tag matching `version` in `extension/manifest.json` is pushed; bump that version for every release. For a Chrome Web Store submission, every text the form asks for (description, single purpose, permission justifications, data usage, reviewer notes) is in `STORE.md`; publish `PRIVACY.md` at a public address and add that address to the form.

## Known limits

- Hover, focus and active are read only at the widest viewport; focus/active only for changes on the element itself.
- JavaScript animations come across frozen as they were when captured (a sliding carousel on its current slide, for example).
- If hover candidates are defined in CSS loaded from another domain, they're found by guessing (links, buttons, `cursor: pointer`).
- An element that takes its height from a neighbour in its row keeps that height as `min-h` when captured on its own.
- If you pick an element that is `display: contents` at some widths, at those widths it depends on its parent's layout and won't look the same on its own. Pick its parent instead.
- Blocks repeated fewer than 3 times aren't turned into loops.
- Canvas and WebGL drawings become still images; closed shadow DOM content can't be cloned.
- Colour and font token names (`accent`, `ink`, `tone-95`…) are the same in every clone, so a second clone saved to the same project overrides the earlier one's tokens of the same name.
- Bot-protected pages (Cloudflare challenges and the like) are deliberately not cloned; you get a clear error.
- The cache invalidates itself when `extract.js` changes.

## Responsible use

MirrorUI is meant for learning how a layout is built, prototyping, and recreating your own or your client's pages. You are responsible for how you use what it produces.

- **Other people's work stays theirs.** Designs, text, images, videos, logos and fonts on a website are usually protected by copyright, trademark or licence terms. Capturing them doesn't give you any right to them. Don't publish a clone of someone else's site, or pass off its content or branding as your own; use it as inspiration and a starting point, and replace the content with your own.
- **Follow the site's terms.** Some sites' terms of use forbid copying or automated access. Respect them, and don't use MirrorUI to get around paywalls, logins or other access controls. It works on pages you're signed in to because it reads your own open tab: content behind a login is often private or licensed to you only, so don't publish it.
- **Downloads are for material you may use.** The Assets tool, Download ZIP and Save to project copy files from the page; only use the ones you have the right to.
- **Personal data:** if a page shows other people's personal data, don't capture or share it.

MirrorUI is provided as is, without warranty (see [LICENSE](LICENSE)); its authors aren't responsible for how it's used.

## License

MIT, see [LICENSE](LICENSE). `extension/vendor/tailwindcss-browser.js` comes with Tailwind CSS's own MIT license (`extension/vendor/tailwindcss-LICENSE`).

MIT covers MirrorUI's own code only. Designs, images and fonts taken from other people's sites belong to their owners; MirrorUI's license doesn't cover them.
