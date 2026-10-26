"""Open a page once per viewport, freeze it, and run extract.js on the chosen element."""
import asyncio
import base64
import hashlib
import json
import math
import re
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


STATES = ('hover', 'focus', 'focus-visible', 'active')


async def state_pass(page, root):
    """Force each state (:hover, :focus…) on each candidate through the DevTools protocol and record what it
    restyles: {state: {i: diff}}."""
    cdp = await page.context.new_cdp_session(page)
    await cdp.send('DOM.enable')
    await cdp.send('CSS.enable')
    doc = await cdp.send('DOM.getDocument', {'depth': 0})
    out = {state: {} for state in STATES}
    for i in hover_candidates(root):
        found = await cdp.send('DOM.querySelector', {'nodeId': doc['root']['nodeId'], 'selector': f'[data-mui-hover="{i}"]'})
        if not found.get('nodeId'):
            continue
        for state in STATES:
            await cdp.send('CSS.forcePseudoState', {'nodeId': found['nodeId'], 'forcedPseudoClasses': [state]})
            diff = await page.evaluate('i => MirrorUIExtract.hoverDiff(i)', i)
            await cdp.send('CSS.forcePseudoState', {'nodeId': found['nodeId'], 'forcedPseudoClasses': []})
            if diff:
                out[state][str(i)] = diff
    await cdp.detach()
    return out


def canvas_nodes(node):
    if 'text' in node:
        return []
    return ([node['i']] if node.get('cv') else []) + [i for c in node.get('c', []) for i in canvas_nodes(c)]


async def canvas_shots(page, root, limit=8):
    """Canvases that can't be read back (WebGL, tainted) photographed alone: {i: data URL}."""
    out = {}
    for i in canvas_nodes(root)[:limit]:
        box = await page.evaluate('i => MirrorUIExtract.isolate(i)', i)
        if box and 1 <= box['width'] <= 4000 and 1 <= box['height'] <= 4000:
            png = await page.screenshot(clip=snap(box), full_page=True, animations='disabled')
            out[str(i)] = 'data:image/png;base64,' + base64.b64encode(png).decode()
    await page.evaluate('MirrorUIExtract.unisolate()')
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


class Replay:
    """Offline, repeatable captures for tests: answer every request from a recorded HAR (nothing goes to the
    network) and freeze the page clock, so carousels, live clocks and "x minutes ago" stay put. Timers only
    run when we advance the clock by `settle_ms` after load and between scroll steps."""

    def __init__(self, har, clock_ms=1_790_000_000_000, settle_ms=1500):
        self.har, self.clock_ms, self.settle_ms = str(har), clock_ms, settle_ms

    async def attach(self, ctx):
        # web requests only: the clone being verified is a local file
        await ctx.route_from_har(self.har, url=re.compile(r'^https?://'), not_found='abort')

    async def before_load(self, page):
        await page.clock.install(time=self.clock_ms / 1000)
        await page.clock.pause_at(self.clock_ms / 1000)

    def body(self, url):
        """A recorded response body (e.g. a font file), or None."""
        import zipfile
        with zipfile.ZipFile(self.har) as z:
            entries = json.loads(z.read('har.har'))['log']['entries']
            for e in entries:
                if e['request']['url'] == url and e['response']['content'].get('_file'):
                    return z.read(e['response']['content']['_file'])
        return None


async def scroll_through(page, replay=None):
    """Scroll the page once so lazy images and scroll-reveal content settle in their final state."""
    height = await page.evaluate('document.body.scrollHeight')
    step = await page.evaluate('innerHeight')
    for y in range(0, height, max(step, 200)):
        await page.evaluate('y => scrollTo(0, y)', y)
        if replay:
            await page.clock.run_for(80)  # a paused clock: advance it instead of waiting
        else:
            await page.wait_for_timeout(80)
    await page.evaluate('scrollTo(0, 0)')


async def capture_viewport(browser: Browser, url, selector, width, shot_path=None, widest=False, replay=None):
    # No reduced-motion emulation: sites drop their transitions under it, and the freeze in extract.js
    # already stops animations. This also keeps captures identical to the extension's.
    ctx = await browser.new_context(viewport={'width': width, 'height': VIEWPORT_HEIGHT},
                                    bypass_csp=True, device_scale_factor=1)
    try:
        if replay:
            await replay.attach(ctx)
        page = await ctx.new_page()
        if replay:
            await replay.before_load(page)
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
        if replay:
            await page.clock.run_for(replay.settle_ms)  # let the page's start-up timers fire, the same way every run
        await page.add_script_tag(content=EXTRACT_JS)
        await page.evaluate('MirrorUIExtract.freeze()')
        await scroll_through(page, replay)
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
            states = await state_pass(page, data['root'])
            data['hover'] = states.pop('hover')
            data['states'] = states
            data['fontSheets'] = await fetch_sheets(ctx, data['fonts']['sheets'], url)
        if shot_path and data['rect']['width'] >= 1 and data['rect']['height'] >= 1:
            # (a hidden or display:contents element has no box to photograph at this width)
            # fixed headers and cookie banners would otherwise land on top of the element in the screenshot
            await page.evaluate('s => MirrorUIExtract.hideOverlays(s)', selector)
            # a clip of the measured box, like the extension; element screenshots wait for "stable" boxes forever
            await page.screenshot(path=str(shot_path), clip=snap(data['rect']), full_page=True, animations='disabled')
            data['canvas'] = await canvas_shots(page, data['root'])
        elif shot_path:
            shot_path.unlink(missing_ok=True)  # a stale one from an earlier run would be compared instead
        return data
    finally:
        await ctx.close()


async def download_fonts(browser: Browser, urls, referer, replay=None):
    """Font files as data: URLs, so the clone renders with them anywhere (no CORS, no hotlinking).
    With a replay they come from the recording instead of the network."""
    def data_url(url, body):
        ext = url.split('?')[0].rsplit('.', 1)[-1].lower()
        mime = {'woff2': 'font/woff2', 'woff': 'font/woff', 'ttf': 'font/ttf', 'otf': 'font/otf'}.get(ext, 'font/woff2')
        return f'data:{mime};base64,' + base64.b64encode(body).decode()

    if replay:
        return {url: data_url(url, body) for url in urls if (body := replay.body(url))}
    ctx = await browser.new_context()
    files = {}
    try:
        for url in urls:
            try:
                r = await ctx.request.get(url, headers={'Referer': referer}, timeout=20_000)
            except PWError:
                continue
            if r.ok:
                files[url] = data_url(url, await r.body())
    finally:
        await ctx.close()
    return files


async def capture(browser: Browser, url, selector, viewports=DEFAULT_VIEWPORTS, out_dir=None, use_cache=True, replay=None):
    """Returns one extractor result per viewport. Screenshots of the original go to out_dir."""
    CACHE_DIR.mkdir(exist_ok=True)
    results = []
    for width in viewports:
        widest = width == max(viewports)
        cached = CACHE_DIR / f'{cache_key(url, selector, width, widest)}.json'
        shot = Path(out_dir) / f'original-{width}.png' if out_dir else None
        if use_cache and not replay and cached.exists() and (shot is None or shot.exists()):
            results.append(json.loads(cached.read_text(encoding='utf-8')))
            continue
        data = await capture_viewport(browser, url, selector, width, shot, widest, replay)
        cached.write_text(json.dumps(data), encoding='utf-8')
        results.append(data)
    return results


# One request at a time per domain, a couple in total: we act like a person opening a page.
_domain_locks: dict[str, asyncio.Lock] = {}


def domain_lock(url):
    from urllib.parse import urlparse
    host = urlparse(url).hostname or 'local'
    return _domain_locks.setdefault(host, asyncio.Lock())
