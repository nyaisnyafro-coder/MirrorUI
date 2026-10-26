"""Chrome Web Store images: five 1280×800 screenshots of the extension at work on store/showcase.html (a
made-up page, so no third-party content ends up in the listing) and the promo tiles.

    python scripts/store_images.py      -> store/screenshot-1..5.png, store/promo-small.png, store/promo-marquee.png
"""
import base64
import functools
import http.server
import sys
import tempfile
import threading
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tests'))
from test_extension import SAVE_INTO_FAKE_PROJECT  # noqa: E402

EXTENSION = str(ROOT / 'extension')
OUT = ROOT / 'store'
SIZE = {'width': 1280, 'height': 800}


def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    handler.log_message = lambda *a: None
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return f'http://127.0.0.1:{httpd.server_address[1]}/store/showcase.html'


def tool(page, label):
    page.locator('mirrorui-root button.tool', has_text=label).click()


def result(page):
    modal = page.locator('mirrorui-root .modal')
    expect(modal.locator('pre')).to_contain_text('---', timeout=60_000)
    page.wait_for_timeout(1200)  # previews settle
    return modal


def promo(browser, name, width, height, big):
    logo = base64.b64encode((ROOT / 'extension' / 'icons' / '128.png').read_bytes()).decode()
    page = browser.new_page(viewport={'width': width, 'height': height})
    page.set_content(f'''<body style="margin:0;width:{width}px;height:{height}px;display:flex;align-items:center;gap:{big // 2}px;
      padding:0 {big}px;box-sizing:border-box;font-family:'Segoe UI',system-ui,sans-serif;color:#ece9f4;
      background:radial-gradient(circle at 80% 20%,#3b2a7a,#141022 60%)">
      <img src="data:image/png;base64,{logo}" style="width:{big * 2}px;height:{big * 2}px">
      <div><div style="font-size:{big}px;font-weight:800;letter-spacing:-.02em">MirrorUI</div>
      <div style="font-size:{big * .42:.0f}px;color:#b9b1d6;margin-top:{big // 6}px;line-height:1.3">Any component → responsive<br>Tailwind&nbsp;v4 + Astro</div></div></body>''')
    page.screenshot(path=str(OUT / name))
    page.close()


def main():
    url = serve()
    with sync_playwright() as pw, tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as profile:
        ctx = pw.chromium.launch_persistent_context(
            profile, channel='chromium', headless=True, viewport=SIZE,
            args=[f'--disable-extensions-except={EXTENSION}', f'--load-extension={EXTENSION}'])
        worker = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker')

        def open_page():
            page = ctx.new_page()
            page.goto(url)
            page.bring_to_front()
            worker.evaluate('async () => { const [t] = await chrome.tabs.query({ active: true }); await toggleToolbar(t.id); }')
            expect(page.locator('mirrorui-root .bar')).to_be_visible()
            return page

        # 1. Pick a component: original and clone side by side
        page = open_page()
        tool(page, 'Pick')
        page.locator('.hero').hover(position={'x': 4, 'y': 4})
        page.keyboard.press('ArrowUp')  # the whole <main>: hero and feature cards
        page.keyboard.press('Enter')
        modal = result(page)
        modal.locator('button', has_text='Side by side').click()
        page.wait_for_timeout(1200)
        page.screenshot(path=str(OUT / 'screenshot-1.png'))

        # 2. Clone page: split into section components
        tool(page, 'Clone page')
        page.locator('mirrorui-root .panel button', has_text='Clone this page').click()
        modal = result(page)
        page.screenshot(path=str(OUT / 'screenshot-2.png'))
        page.close()

        # 3. Inspect an element
        page = open_page()
        tool(page, 'Inspect')
        page.locator('.cta').hover()
        page.locator('.cta').click()
        page.wait_for_timeout(600)
        page.locator('.card').nth(1).hover()
        page.wait_for_timeout(400)
        page.screenshot(path=str(OUT / 'screenshot-3.png'))

        # 4. Colours of the page
        tool(page, 'Colors')
        page.wait_for_timeout(600)
        page.screenshot(path=str(OUT / 'screenshot-4.png'))

        # 5. Full view, saved into an Astro project
        tool(page, 'Pick')
        page.locator('.hero').hover(position={'x': 4, 'y': 4})
        page.keyboard.press('Enter')
        modal = result(page)
        with ctx.expect_page() as opened:
            modal.locator('button', has_text='Save to project').click()
        results = opened.value
        results.on('dialog', lambda d: d.accept())
        expect(results.locator('#code')).to_contain_text('---')
        results.evaluate(SAVE_INTO_FAKE_PROJECT)
        results.wait_for_timeout(1200)
        results.evaluate('scrollTo(0, 0)')
        results.screenshot(path=str(OUT / 'screenshot-5.png'))

        ctx.close()
        browser = pw.chromium.launch()
        promo(browser, 'promo-small.png', 440, 280, 40)
        promo(browser, 'promo-marquee.png', 1400, 560, 84)
        browser.close()
    print('\n'.join(sorted(str(p.relative_to(ROOT)) for p in OUT.glob('*.png'))))


if __name__ == '__main__':
    main()
