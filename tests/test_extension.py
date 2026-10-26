"""The browser extension, loaded unpacked into Chromium: the toolbar, Pick, Clone page and the page tools,
driven like a user would (pages come from the local test server, nothing from the network).

    pytest -m extension
"""
import re
import zipfile

import pytest
from playwright.sync_api import expect, sync_playwright

from conftest import ROOT

pytestmark = pytest.mark.extension
EXTENSION = str(ROOT / 'extension')
TOOLS = ['Pick', 'Clone page', 'Inspect', 'Design MD', 'Colors', 'Fonts', 'Assets', 'Responsive', 'Capture',
         'Edit text', 'Swap font', 'Arrange']


@pytest.fixture(scope='module')
def browser_ctx(tmp_path_factory):
    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            str(tmp_path_factory.mktemp('profile')), channel='chromium', headless=True,
            viewport={'width': 1280, 'height': 900},
            args=[f'--disable-extensions-except={EXTENSION}', f'--load-extension={EXTENSION}'])
        worker = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event('serviceworker')
        yield ctx, worker
        ctx.close()


@pytest.fixture
def toolbar(browser_ctx):
    """Opens a page with the toolbar shown, as the toolbar button would."""
    ctx, worker = browser_ctx
    pages = []

    def open_page(url):
        page = ctx.new_page()
        pages.append(page)
        page.goto(url)
        page.bring_to_front()
        worker.evaluate('async () => { const [t] = await chrome.tabs.query({ active: true }); await toggleToolbar(t.id); }')
        expect(page.locator('mirrorui-root .bar')).to_be_visible()
        return page

    yield open_page
    for page in pages:
        page.close()


def tool(page, label):
    page.locator('mirrorui-root button.tool', has_text=label).click()


def test_toolbar_has_every_tool(toolbar, server):
    page = toolbar(f'{server}/fixtures/demo.html')
    labels = page.locator('mirrorui-root .bar button.tool').all_inner_texts()
    assert [l.strip() for l in labels if l.strip()] == TOOLS


def test_pick_clones_a_component(toolbar, server):
    page = toolbar(f'{server}/fixtures/demo.html')
    tool(page, 'Pick')
    page.locator('.wrap h2').hover()
    page.keyboard.press('ArrowUp')  # from the heading to its section
    page.keyboard.press('Enter')
    modal = page.locator('mirrorui-root .modal')
    expect(modal.locator('pre')).to_contain_text('---', timeout=60_000)  # the Astro frontmatter
    modal.locator('button', has_text='HTML').first.click()
    html = modal.locator('pre').inner_text()
    assert 'What we build' in html and 'md:' in html and 'undefined' not in html
    # the preview renders the clone
    frame = modal.locator('iframe').first.content_frame
    expect(frame.locator('text=What we build')).to_be_visible()


def test_pick_keeps_states_and_canvases(toolbar, server):
    page = toolbar(f'{server}/tests/cases/interactive.html')
    tool(page, 'Pick')
    page.locator('#t').hover(position={'x': 300, 'y': 10})
    page.keyboard.press('Enter')
    modal = page.locator('mirrorui-root .modal')
    expect(modal.locator('pre')).to_contain_text('---', timeout=60_000)
    modal.locator('button', has_text='HTML').first.click()
    html = modal.locator('pre').inner_text()
    for needle in ('focus-visible:outline-solid', 'active:scale-95', 'hover:scale-110', 'data:image/png;base64,'):
        assert needle in html, needle
    assert '<canvas' not in html


def pick_zip(page, selector):
    """Picks the element and downloads the result's ZIP: {name: bytes}."""
    tool(page, 'Pick')
    page.locator(selector).hover(position={'x': 5, 'y': 5})
    page.keyboard.press('Enter')
    modal = page.locator('mirrorui-root .modal')
    expect(modal.locator('pre')).to_contain_text('---', timeout=60_000)
    with page.expect_download() as download:
        modal.locator('button', has_text='Download ZIP').click()
    with zipfile.ZipFile(download.value.path()) as z:
        return {name: z.read(name) for name in z.namelist()}


def test_zip_is_an_astro_project_with_its_assets(toolbar, server):
    page = toolbar(f'{server}/tests/cases/bg-url.html')
    files = pick_zip(page, '#t')
    assert {'index.html', 'src/components/Component.astro', 'src/styles/theme.css', 'README.md',
            'public/clone-assets/bg-pattern.svg'} <= set(files)
    assert files['public/clone-assets/bg-pattern.svg'].startswith(b'<svg')
    astro, html = files['src/components/Component.astro'].decode(), files['index.html'].decode()
    assert "url('/clone-assets/bg-pattern.svg')" in astro and 'bg\\_pattern' not in astro
    assert "url('public/clone-assets/bg-pattern.svg')" in html

    # canvases: their pictures become files too, one per breakpoint
    page = toolbar(f'{server}/tests/cases/interactive.html')
    files = pick_zip(page, '#t')
    pngs = [n for n in files if n.endswith('.png')]
    assert pngs and all(files[n].startswith(b'\x89PNG') for n in pngs)
    # (tiny pictures may stay inline)
    assert not re.search(r'data:image/png;base64,[\w+/=]{4096,}', files['src/components/Component.astro'].decode())


def test_clone_page_preview_height_is_stable(toolbar, server):
    page = toolbar(f'{server}/tests/cases/min-h-screen.html')
    tool(page, 'Clone page')
    page.locator('mirrorui-root .panel button', has_text='Clone this page').click()
    frame = page.locator('mirrorui-root .modal iframe').first
    expect(frame).to_be_visible(timeout=60_000)
    page.wait_for_timeout(800)
    first = frame.bounding_box()['height']
    page.wait_for_timeout(1200)
    # 100vh inside a frame sized to its content used to grow it forever
    assert frame.bounding_box()['height'] == first
    assert first < 2000


def test_colors_and_fonts_list_the_page(toolbar, server):
    page = toolbar(f'{server}/fixtures/demo.html')
    tool(page, 'Colors')
    panel = page.locator('mirrorui-root .panel')
    expect(panel).to_contain_text('#')
    tool(page, 'Fonts')
    expect(panel).to_contain_text('Arial', ignore_case=True)


def test_edit_text_and_undo(toolbar, server):
    page = toolbar(f'{server}/fixtures/demo.html')
    heading = page.locator('.wrap h2')
    tool(page, 'Edit text')
    heading.click()
    page.keyboard.press('Control+A')
    page.keyboard.type('Edited heading')
    page.keyboard.press('Escape')
    expect(heading).to_have_text('Edited heading')
    page.keyboard.press('Control+Z')
    expect(heading).to_have_text('What we build')
