"""Record the real sites in tests/sites.json as HAR archives, so test_sites.py can replay them offline.

    python tests/record_sites.py                 # all of them
    python tests/record_sites.py my-site

Each page is loaded at every capture width and scrolled, so responsive images and lazy content are in the
recording. The list (tests/sites.json, see tests/sites.example.json) and the recordings stay on this machine,
both git-ignored: recordings hold other people's content, like news photos. Re-record when a site changes on
purpose; thresholds live in sites.json.
"""
import asyncio
import json
import sys
import zipfile
from pathlib import Path

from playwright.async_api import async_playwright

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from mirrorui.capture import DEFAULT_VIEWPORTS, scroll_through  # noqa: E402

SITES_FILE = HERE / 'sites.json'
if not SITES_FILE.exists():
    sys.exit('no tests/sites.json: copy tests/sites.example.json and list your sites in it')
SITES = json.loads(SITES_FILE.read_text(encoding='utf-8'))


async def record(name, site):
    har = HERE / 'sites' / f'{name}.har.zip'
    har.parent.mkdir(exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        ctx = await browser.new_context(record_har_path=str(har), record_har_mode='full')
        page = await ctx.new_page()
        for width in DEFAULT_VIEWPORTS:
            await page.set_viewport_size({'width': width, 'height': 900})
            await page.goto(site['url'], wait_until='load', timeout=60_000)
            try:
                await page.wait_for_load_state('networkidle', timeout=15_000)
            except Exception:
                pass
            await scroll_through(page)
            # every image at this width, lazy ones too: captures load them all (settleImages in extract.js)
            await page.evaluate("""() => Promise.race([new Promise((r) => setTimeout(r, 15000)), Promise.all([...document.images]
                .map((img) => { img.loading = 'eager'; return img.complete ? null
                  : new Promise((r) => { img.onload = img.onerror = r; }); }))])""")
            await page.wait_for_timeout(1500)
        # requests still in flight are dropped from the archive (drop_unfinished): let late images finish
        try:
            await page.wait_for_load_state('networkidle', timeout=20_000)
        except Exception:
            pass
        await page.wait_for_timeout(2000)
        await ctx.close()  # writes the archive
        await browser.close()
    dropped = drop_unfinished(har)
    print(f'{name}: {har.stat().st_size / 1e6:.1f} MB, {dropped} unfinished requests dropped -> {har.relative_to(HERE.parent)}')


def drop_unfinished(har):
    """Requests still in flight when recording stopped are stored without a response, and replaying one waits
    forever. Without them they're simply not found, so the replay aborts them at once."""
    with zipfile.ZipFile(har) as z:
        files = {n: z.read(n) for n in z.namelist()}
    log = json.loads(files['har.har'])
    entries = log['log']['entries']
    keep = [e for e in entries if e['response'].get('status', 0) > 0
            and (e['response']['content'].get('_file') in files or e['response']['content'].get('size', 0) == 0
                 or 'text' in e['response']['content'])]
    log['log']['entries'] = keep
    files['har.har'] = json.dumps(log).encode()
    with zipfile.ZipFile(har, 'w', zipfile.ZIP_DEFLATED) as z:
        for n, data in files.items():
            z.writestr(n, data)
    return len(entries) - len(keep)


async def main(names):
    for name in names or SITES:
        await record(name, SITES[name])


if __name__ == '__main__':
    asyncio.run(main(sys.argv[1:]))
