"""Shared helpers for the test suite.

    pytest                      regression cases + extension (offline, ~3 min)
    pytest -m sites             recorded real sites (record them first: python tests/record_sites.py)
    pytest -m "not extension"   skip the browser-extension tests
"""
import asyncio
import functools
import http.server
import sys
import threading
from pathlib import Path

import pytest
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from mirrorui.pipeline import clone  # noqa: E402

OUTPUT = ROOT / 'tests' / 'output'


def run(coro):
    return asyncio.run(coro)


# Text drawn with greyscale antialiasing in both the original and the clone: whether Chrome uses subpixel
# antialiasing depends on how it happens to composite layers (an animated neighbour flips it), not on the clone.
BROWSER_ARGS = ['--disable-lcd-text']


async def clone_url(url, selector, out_dir, replay=None, viewports=(375, 768, 1280), fonts=False):
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(args=BROWSER_ARGS)
        try:
            return await clone(browser, url, selector, out_dir, viewports, use_cache=False, replay=replay, fonts=fonts)
        finally:
            await browser.close()


def assert_matches(result, max_diff, max_height_diff=2):
    """Every viewport within max_diff (fraction of pixels, or {width: fraction}) and the clone as tall as the
    original: within max_height_diff px, or that fraction of the height when it's below 1."""
    assert result['report'], 'nothing was compared'
    for width, r in result['report'].items():
        limit = max_diff[int(width)] if isinstance(max_diff, dict) else max_diff
        assert r['diff'] <= limit, f'{width}px: {r["diff"]:.1%} of pixels differ (limit {limit:.1%})'
        tall = r['size_a'][1]
        allowed = max_height_diff * tall if max_height_diff < 1 else max_height_diff
        assert abs(tall - r['size_b'][1]) <= allowed, f'{width}px: original {r["size_a"]} vs clone {r["size_b"]}'


@pytest.fixture(scope='session')
def server():
    """The repository over http (extensions can't open file:// pages by default)."""
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    handler.log_message = lambda *a: None
    httpd = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f'http://127.0.0.1:{httpd.server_address[1]}'
    httpd.shutdown()
