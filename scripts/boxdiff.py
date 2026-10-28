"""Where does a clone first go wrong? Compares every element's box in the clone with the original's, at one
width, and lists the first mismatches in document order (the first one usually causes the rest).

    python scripts/boxdiff.py my-site 1280             # a recorded site from tests/sites.json, replayed
    python scripts/boxdiff.py https://site.com .hero 768

Boxes are relative to the cloned root; mismatches under half a pixel (BOXDIFF_TOLERANCE) are ignored.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from mirrorui.capture import Replay, capture, download_fonts  # noqa: E402
from mirrorui.compiler import compile_captures, font_urls  # noqa: E402
from mirrorui.verify import TAILWIND_LOCAL  # noqa: E402

OUT = ROOT / 'tests' / 'output' / 'boxdiff'
TOLERANCE = float(os.environ.get('BOXDIFF_TOLERANCE', 0.5))  # px
SITES_FILE = ROOT / 'tests' / 'sites.json'  # your own list, git-ignored (see tests/sites.example.json)
SITES = json.loads(SITES_FILE.read_text(encoding='utf-8')) if SITES_FILE.exists() else {}

BOXES_JS = """() => { const root = document.querySelector('#mirrorui-frame > *').getBoundingClientRect();
  return [...document.querySelectorAll('[data-mui-i]')].map((e) => { const r = e.getBoundingClientRect();
    return [+e.dataset.muiI, r.x - root.x, r.y - root.y, r.width, r.height, e.getAttribute('class') || '']; }); }"""


def flatten(node, out):
    if 'text' in node:
        return out
    out[node['i']] = node
    for c in node.get('c', []):
        flatten(c, out)
    return out


async def main(args):
    if args[0] in SITES:
        site = SITES[args[0]]
        url, selector, width = site['url'], site['selector'], int(args[1])
        replay = Replay(ROOT / 'tests' / 'sites' / f'{args[0]}.har.zip')
    else:
        url, selector, width, replay = args[0], args[1], int(args[2]), None
    viewports = sorted({375, 768, 1280, width})
    OUT.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=['--disable-lcd-text'])  # as the tests do
        captures = await capture(browser, url, selector, viewports, OUT, use_cache=False, replay=replay)
        # the page's fonts embedded, as the site tests do
        files = await download_fonts(browser, await font_urls(browser, captures), url, replay) if replay else {}
        built = await compile_captures(browser, captures, url, fonts=bool(replay), fontFiles=files, trace=width)
        html = OUT / 'index.html'
        html.write_text(built['doc'], encoding='utf-8')
        ctx = await browser.new_context(viewport={'width': width, 'height': 900}, device_scale_factor=1)
        if replay:
            await replay.attach(ctx)
        await ctx.route('https://cdn.jsdelivr.net/npm/@tailwindcss/browser@*', lambda r: r.fulfill(path=str(TAILWIND_LOCAL)))
        page = await ctx.new_page()
        await page.goto(html.resolve().as_uri(), wait_until='load')
        await page.wait_for_timeout(1500)
        boxes = await page.evaluate(BOXES_JS)
        await browser.close()

    cap = next(c for c in captures if c['vw'] == width)
    nodes = flatten(cap['root'], {})
    rx, ry = cap['root']['x'], cap['root']['y']
    bad = []
    for i, x, y, w, h, cls in boxes:
        n = nodes.get(i)
        if not n or n['w'] < 0.5:
            continue
        want = (n['x'] - rx, n['y'] - ry, n['w'], n['h'])
        got = (x, y, w, h)
        if any(abs(a - b) > TOLERANCE for a, b in zip(want, got)):
            bad.append((i, n, want, got, cls))
    print(f'{len(bad)} of {len(boxes)} boxes differ at {width}px')
    for i, n, want, got, cls in bad[:int(args[-1]) if args[-1].isdigit() and len(args) > 2 + (replay is None) else 25]:
        digits = 3 if TOLERANCE < 0.1 else 1
        fmt = lambda b: '({:.{d}f}, {:.{d}f}) {:.{d}f}×{:.{d}f}'.format(*b, d=digits)
        print(f"#{i} <{n['t']}{'.' + n['cn'] if n.get('cn') else ''}> original {fmt(want)}  clone {fmt(got)}\n    {cls[:220]}")


if __name__ == '__main__':
    asyncio.run(main(sys.argv[1:]))
