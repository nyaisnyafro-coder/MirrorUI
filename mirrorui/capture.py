"""Open a page once per viewport, freeze it, and run extract.js on the chosen element."""
import asyncio
import base64
import hashlib
import json
import math
from pathlib import Path

from playwright.async_api import Browser, Error as PWError, TimeoutError as PWTimeout

# shared with the browser extension, which can only load files from its own folder
EXTRACT_JS = (Path(__file__).parent.parent / 'extension' / 'lib' / 'extract.js').read_text(encoding='utf-8')
CACHE_DIR = Path('.cache')
DEFAULT_VIEWPORTS = (375, 768, 1280)
VIEWPORT_HEIGHT = 900

CHALLENGE_MARKERS = ('just a moment', 'attention required', 'access denied', 'verify you are human')


class CaptureError(Exception):
    pass


EXTRACT_VERSION = hashlib.sha1(EXTRACT_JS.encode()).hexdigest()[:8]


def cache_key(url, selector, width, widest):
    # the extractor's hash is part of the key, so captures from an older extract.js are never reused
    return hashlib.sha1(f'{url}|{selector}|{width}|{widest}|{EXTRACT_VERSION}'.encode()).hexdigest()[:16]


def snap(r):
    """Clip on whole pixels, the same way for the original and the clone, so both cover the same pixel rows."""
    x, y = math.floor(r['x']), math.floor(r['y'])
    return {'x': x, 'y': y, 'width': math.ceil(r['x'] + r['width']) - x, 'height': math.ceil(r['y'] + r['height']) - y}


def hover_candidates(node):
    if 'text' in node:
        return []
    return ([node['i']] if node.get('hv') else []) + [i for c in node.get('c', []) for i in hover_candidates(c)]


async def hover_pass(page, root):
    """Force :hover on each candidate through the DevTools protocol and record what it restyles."""
    cdp = await page.context.new_cdp_session(page)
    await cdp.send('DOM.enable')
    await cdp.send('CSS.enable')
    doc = await cdp.send('DOM.getDocument', {'depth': 0})
    out = {}
    for i in hover_candidates(root):
        found = await cdp.send('DOM.querySelector', {'nodeId': doc['root']['nodeId'], 'selector': f'[data-mui-hover="{i}"]'})
        if not found.get('nodeId'):
            continue
        await cdp.send('CSS.forcePseudoState', {'nodeId': found['nodeId'], 'forcedPseudoClasses': ['hover']})
        diff = await page.evaluate('i => MirrorUIExtract.hoverDiff(i)', i)
        await cdp.send('CSS.forcePseudoState', {'nodeId': found['nodeId'], 'forcedPseudoClasses': []})
        if diff:
            out[str(i)] = diff
    await cdp.detach()
    return out


async def fetch_sheets(ctx, urls, referer):
    """Cross-origin stylesheets the page can't read itself, fetched for their @font-face rules."""
    sheets = []
    for url in urls:
        try:
            r = await ctx.request.get(url, headers={'Referer': referer}, timeout=15_000)
            if r.ok:
                sheets.append({'url': url, 'text': await r.text()})
        except PWError:
            pass
    return sheets


async def capture_viewport(browser: Browser, url, selector, width, shot_path=None, widest=False):
    # No reduced-motion emulation: sites drop their transitions under it, and the freeze in extract.js
    # already stops animations. This also keeps captures identical to the extension's.
    ctx = await browser.new_context(viewport={'width': width, 'height': VIEWPORT_HEIGHT},
                                    bypass_csp=True, device_scale_factor=1)
    try:
        page = await ctx.new_page()
        try:
            resp = await page.goto(url, wait_until='load', timeout=45_000)
        except PWError as e:
            raise CaptureError(f'could not open {url}: {e.message.splitlines()[0]}') from None
        if resp and resp.status >= 400:
            raise CaptureError(f'{url} returned HTTP {resp.status}')
        title = (await page.title()).lower()
        if any(m in title for m in CHALLENGE_MARKERS):
            raise CaptureError(f'{url} served a bot challenge page ("{title}"); not cloning it')
        try:
            await page.wait_for_load_state('networkidle', timeout=8_000)
        except PWTimeout:
            pass
        await page.add_script_tag(content=EXTRACT_JS)
        await page.evaluate('MirrorUIExtract.freeze()')
        # walk the page once so lazy images and scroll-reveal content settle in their final state
        await page.evaluate("""async () => {
            for (let y = 0; y < document.body.scrollHeight; y += innerHeight) {
                scrollTo(0, y); await new Promise(r => setTimeout(r, 80));
            }
            scrollTo(0, 0);
        }""")
        await page.evaluate('document.fonts.ready.then(() => true)')
        el = page.locator(selector).first
        if await el.count() == 0:
            raise CaptureError(f'selector not found: {selector}')
        # plain DOM scroll: Playwright's own waits for visibility, which a display:contents element never gets
        await page.evaluate('s => document.querySelector(s).scrollIntoView({block: "start"})', selector)
        await page.wait_for_timeout(300)
        data = await page.evaluate('s => MirrorUIExtract.extract(s)', selector)
        if 'error' in data:
            raise CaptureError(data['error'])
        if widest:
            # hover and fonts don't change with the viewport; the desktop pass collects them
            data['hover'] = await hover_pass(page, data['root'])
            data['fontSheets'] = await fetch_sheets(ctx, data['fonts']['sheets'], url)
        if shot_path and data['rect']['width'] >= 1 and data['rect']['height'] >= 1:
            # (a hidden or display:contents element has no box to photograph at this width)
            # fixed headers and cookie banners would otherwise land on top of the element in the screenshot
            await page.evaluate('s => MirrorUIExtract.hideOverlays(s)', selector)
            # a clip of the measured box, like the extension; element screenshots wait for "stable" boxes forever
            await page.screenshot(path=str(shot_path), clip=snap(data['rect']), full_page=True, animations='disabled')
        elif shot_path:
            shot_path.unlink(missing_ok=True)  # a stale one from an earlier run would be compared instead
        return data
    finally:
        await ctx.close()


async def download_fonts(browser: Browser, urls, referer):
    """Font files as data: URLs, so the clone renders with them anywhere (no CORS, no hotlinking)."""
    ctx = await browser.new_context()
    files = {}
    try:
        for url in urls:
            try:
                r = await ctx.request.get(url, headers={'Referer': referer}, timeout=20_000)
            except PWError:
                continue
            if r.ok:
                ext = url.split('?')[0].rsplit('.', 1)[-1].lower()
                mime = {'woff2': 'font/woff2', 'woff': 'font/woff', 'ttf': 'font/ttf', 'otf': 'font/otf'}.get(ext, 'font/woff2')
                files[url] = f'data:{mime};base64,' + base64.b64encode(await r.body()).decode()
    finally:
        await ctx.close()
    return files


async def capture(browser: Browser, url, selector, viewports=DEFAULT_VIEWPORTS, out_dir=None, use_cache=True):
    """Returns one extractor result per viewport. Screenshots of the original go to out_dir."""
    CACHE_DIR.mkdir(exist_ok=True)
    results = []
    for width in viewports:
        widest = width == max(viewports)
        cached = CACHE_DIR / f'{cache_key(url, selector, width, widest)}.json'
        shot = Path(out_dir) / f'original-{width}.png' if out_dir else None
        if use_cache and cached.exists() and (shot is None or shot.exists()):
            results.append(json.loads(cached.read_text(encoding='utf-8')))
            continue
        data = await capture_viewport(browser, url, selector, width, shot, widest)
        cached.write_text(json.dumps(data), encoding='utf-8')
        results.append(data)
    return results


# One request at a time per domain, a couple in total: we act like a person opening a page.
_domain_locks: dict[str, asyncio.Lock] = {}


def domain_lock(url):
    from urllib.parse import urlparse
    host = urlparse(url).hostname or 'local'
    return _domain_locks.setdefault(host, asyncio.Lock())
