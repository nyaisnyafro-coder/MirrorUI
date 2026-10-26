"""Regression cases: one small page per bug found so far. Each must clone pixel-exact at every width, and the
output must contain the classes the fix produces (or not contain the ones the bug produced)."""
import re

import pytest
from playwright.async_api import async_playwright

from conftest import OUTPUT, ROOT, assert_matches, clone_url, run
from mirrorui.capture import capture
from mirrorui.compiler import compile_captures

CASES = ROOT / 'tests' / 'cases'

# name: (page, selector, patterns that must match the generated HTML, patterns that must not)
EXPECT = {
    'flex-min-w-0': ('flex-min-w-0.html', '#t', [r'<main class="[^"]*\bmin-w-0\b'], []),
    'svg-img-size': ('svg-img-size.html', '#t', [r'<img class="[^"]*\bw-7\b[^"]*\bh-7\b', r'<svg class="[^"]*\bw-4\b[^"]*\bh-4\b'], []),
    'bg-url': ('bg-url.html', '#t', [r"url\('[^']*bg\\_pattern\.svg'\)"], [r'url\("']),
    'line-clamp': ('line-clamp.html', '#t', [r'<h3 class="[^"]*\bline-clamp-3\b'], [r'<h3 class="[^"]*\bflow-root\b']),
    'fixed-centered': ('fixed-centered.html', '#t',
                       [r'left-\[calc\(50%_-_7\.5px\)\]', r'-translate-x-1/2', r'w-\[calc\(100%_-_40px\)\]'], []),
    'auto-margins': ('auto-margins.html', '#t', [r'\bmt-auto\b', r'\bmx-auto\b'], []),
    'display-contents': ('display-contents.html', '#t', [r'class="contents\b', r'\bmd:flex\b'], []),
    'underline': ('underline.html', '#t', [r'\bdecoration-2\b', r'\bunderline-offset-4\b'], []),
    'min-h-screen': ('min-h-screen.html', '#t', [r'\bmin-h-screen\b'], []),
    'shadows': ('shadows.html', '#t', [r'shadow-\[0px_30px_60px_-20px_rgba\(76,29,149,0\.6\)\]',
                                       r'shadow-\[inset_0px_2px_6px_0px_rgb\(148,163,184\),0px_0px_0px_3px_rgb\(199,210,254\)\]'], []),
    'interactive': ('interactive.html', '#t',
                    [r'\bfocus-visible:outline-solid\b', r'\bfocus-visible:outline-offset-2\b', r'\bactive:scale-95\b',
                     r'\bfocus:shadow-\[', r'\bfocus:border-accent-2\b',r'\brotate-6\b', r'\bhover:scale-110\b',
                     r'<img class="[^"]*\bw-40\b[^"]*" src="data:image/png;base64,[^"]{200,}"'],
                    [r'<canvas', r'focus-visible:outline-auto']),
    'states': ('../../fixtures/demo.html', '.wrap',
               [r'\bhover:bg-accent\b', r'\bgroup-hover:text-accent\b', r"before:content-\['★_'\]", r'\bafter:w-12\b',
                r'\btransition-colors\b', r'\bmt-auto\b'], []),
}


@pytest.mark.parametrize('name', EXPECT)
def test_case(name):
    page, selector, must, must_not = EXPECT[name]
    result = run(clone_url((CASES / page).resolve().as_uri(), selector, OUTPUT / 'cases' / name))
    assert_matches(result, 0.005)
    for pattern in must:
        assert re.search(pattern, result['doc']), f'missing {pattern}'
    for pattern in must_not:
        assert not re.search(pattern, result['doc']), f'unexpected {pattern}'


def test_page_splits_into_section_components():
    result = run(clone_url((CASES / 'page-sections.html').resolve().as_uri(), 'body', OUTPUT / 'cases' / 'page-sections'))
    assert_matches(result, 0.005)
    out = OUTPUT / 'cases' / 'page-sections'
    page = (out / 'Page.astro').read_text(encoding='utf-8')
    for name in ('Header', 'Hero', 'Features', 'Footer'):
        assert f"import {name} from './page/{name}.astro';" in page and f'<{name} />' in page
        assert (out / 'page' / f'{name}.astro').exists()
    assert '<main' in page  # the structure around the sections stays in the page
    hero = (out / 'page' / 'Hero.astro').read_text(encoding='utf-8')
    for prop in ('title = "Build faster"', 'text = "Everything you need to ship."', 'label = "Get started"', 'href = "file:///'):
        assert prop in hero, prop
    assert '{title}' in hero and 'href={href}' in hero
    features = (out / 'page' / 'Features.astro').read_text(encoding='utf-8')
    assert 'cards.map((card)' in features


def test_preview_has_no_vh_feedback():
    """Previews render in iframes sized to their content: h-screen there must be fixed px, the code keeps it."""
    async def go():
        async with async_playwright() as pw:
            browser = await pw.chromium.launch()
            try:
                caps = await capture(browser, (CASES / 'min-h-screen.html').resolve().as_uri(), '#t', use_cache=False)
                return (await compile_captures(browser, caps)), (await compile_captures(browser, caps, preview=True))
            finally:
                await browser.close()
    code, preview = run(go())
    assert 'min-h-screen' in code['doc']
    assert 'min-h-screen' not in preview['doc'] and 'min-h-[900px]' in preview['doc']
