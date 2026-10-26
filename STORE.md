# Chrome Web Store submission

Everything the developer dashboard asks for, ready to paste. Build the upload with
`python scripts/package_extension.py` (→ `dist/mirrorui-<version>.zip`) and the images with
`python scripts/store_images.py` (→ `store/`).

Before the first submission:

1. Register a developer account at https://chrome.google.com/webstore/devconsole (one-time USD 5 fee) and
   verify the contact email.
2. Publish `PRIVACY.md` at a public URL (a GitHub Pages site or a public gist works) after replacing
   `SUPPORT_EMAIL`, and paste that URL into **Privacy → Privacy policy**.
3. Expect a longer first review: `debugger` and access to all sites are reviewed by hand.

## Store listing

**Name:** MirrorUI

**Summary** (max. 132 characters, same as the manifest description):
Clone any component as responsive Tailwind v4 HTML and Astro, inspect elements, and pull a page's colours, fonts and assets.

**Category:** Developer Tools  **Language:** English (add Turkish below as a second language)

**Description:**

```
MirrorUI turns what you see on a web page into clean, responsive Tailwind CSS v4 and Astro code — no AI, no account, nothing leaves your browser.

PICK & CLONE
• Pick any component (or clone the whole page) and get it at phone, tablet and desktop widths, merged into responsive Tailwind classes (md:, lg:).
• Astro output: repeated cards become a loop over a typed prop, headings, texts, links and images become props, and a cloned page is split into Header, Hero, Footer… components.
• Hover, focus and active styles, transitions, transforms and pseudo-elements come along. Canvas and WebGL drawings become images.
• Side-by-side preview of original and clone at every width.
• Download a ZIP that drops into an Astro project (components, theme, images, videos and fonts under public/) — or save straight into your project folder.

INSPECT THE PAGE
• Inspect: box model, typography, colours and distances between elements; copy as CSS or Tailwind.
• Colors: every colour the page uses, exportable as CSS variables, a Tailwind @theme or JSON.
• Fonts: the font families actually rendered, with weights, sizes and @font-face.
• Assets: images, inline SVGs, background images, videos and icons, downloadable one by one or together.
• Design MD: the page's measured design system (tokens, type scale, spacing, radii, shadows) as DESIGN.md.

TRY CHANGES BEFORE YOU CLONE
• Edit text in place, swap fonts with any Google Font, and move or delete elements — the clone captures your changes.
• Responsive: show the tab at phone, tablet or desktop size; Capture: screenshots of the viewport, the full page, an element or a region.

Open it with the toolbar button or Alt+Shift+M. Only use designs, images and fonts you have the rights to.
```

**Turkish description** (second language): translate the text above, or start from the README.

**Images** (from `scripts/store_images.py`):
- Store icon: `extension/icons/128.png`
- Screenshots (1280×800): `store/screenshot-1.png` … `store/screenshot-5.png`
- Small promo tile (440×280): `store/promo-small.png`
- Marquee promo tile (1400×560, optional): `store/promo-marquee.png`

## Privacy practices tab

**Single purpose:**
Turn parts of the web page the user is viewing into reusable Tailwind CSS and Astro code, together with the
inspection tools needed for that (element inspector, colours, fonts, assets, responsive preview, screenshots).

**Permission justifications:**

| Permission | Justification |
|---|---|
| `activeTab` | The toolbar is injected only into the tab where the user clicks the toolbar button or presses the shortcut. |
| `scripting` | Injects the toolbar and the capture script into that tab to read the picked element's structure and computed styles. |
| `debugger` | Used on the active tab only while a capture, responsive preview or full-page screenshot runs: Emulation.setDeviceMetricsOverride shows the page at phone/tablet/desktop widths so responsive styles can be captured, CSS.forcePseudoState reads hover/focus/active styles, and Page.captureScreenshot takes screenshots beyond the viewport for the original-vs-clone comparison. There is no other way for an extension to lay a tab out at another width. |
| `storage` | Keeps the last 8 clones (so a result can be reopened in a tab), settings and panel positions locally. |
| `unlimitedStorage` | A clone includes screenshots at three widths; a few full-page clones exceed the default local storage quota. |
| `downloads` | Saves the ZIP, the generated files, screenshots and assets the user chooses to download. |
| Host permission `<all_urls>` | The user can open the toolbar on any site. Fonts, images and stylesheets of the page are often on other origins (CDNs); the service worker fetches them, without cookies, when the user embeds fonts, downloads assets or exports a project. Cross-origin stylesheets are read for their @font-face rules. |

**Remote code:** No, I am not using remote code. (Tailwind's browser build used for the previews is bundled in
`vendor/`; the Google Fonts requests of Swap font load CSS and font files only.)

**Data usage** — tick:
- **Website content** (the extension reads the content of the page the user picks from, locally, to generate code).

Leave everything else unticked, and certify all three statements: data is not sold to third parties, not used or
transferred for purposes unrelated to the item's single purpose, and not used to determine creditworthiness or
for lending.

## Test instructions for the reviewer

```
1. Open any page, e.g. https://getbootstrap.com/docs/5.3/examples/
2. Click the MirrorUI toolbar button (or Alt+Shift+M). A toolbar appears at the bottom of the page.
3. Click "Pick", hover a card and click it. The page is shown at 375, 768 and 1280 px for a moment (the browser
   shows a "MirrorUI started debugging this browser" bar during this); the result window then shows the
   generated Astro/HTML code and a preview of the clone.
4. "Download ZIP" downloads the generated project files. No login is needed.
```
