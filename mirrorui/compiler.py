"""Run compile.js (shared with the browser extension) on captures inside a blank Playwright page."""
from pathlib import Path

from playwright.async_api import Browser

# shared with the browser extension, which can only load files from its own folder
COMPILE_JS = (Path(__file__).parent.parent / 'extension' / 'lib' / 'compile.js').read_text(encoding='utf-8')


async def _call(browser: Browser, expression, arg):
    page = await browser.new_page()
    try:
        await page.add_script_tag(content=COMPILE_JS)
        return await page.evaluate(expression, arg)
    finally:
        await page.close()


async def compile_captures(browser: Browser, captures, source_url='', **options):
    """Returns {doc, fragment, theme, themeFile, astroName, astro}.
    options: fonts=True to include the component's @font-face rules, fontFiles={url: data_url} to inline them."""
    return await _call(browser, '([c, o]) => MirrorUICompile.build(c, o)', [captures, {'sourceUrl': source_url, **options}])


async def font_urls(browser: Browser, captures, all_fonts=True):
    """Font file URLs referenced by the @font-face rules of the families the component uses (all_fonts=False:
    its icon fonts only, which a clone always needs)."""
    faces = await _call(browser, '([c, a]) => MirrorUICompile.neededFaces(c, a)', [captures, all_fonts])
    return list(dict.fromkeys(u for f in faces for u in f['urls']))
