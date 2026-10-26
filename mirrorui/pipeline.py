"""capture -> compile (compile.js) -> write HTML + Astro -> verify, shared by the CLI and the API."""
from pathlib import Path

from .capture import DEFAULT_VIEWPORTS, capture, domain_lock, download_fonts
from .compiler import compile_captures, font_urls
from .verify import verify


async def clone(browser, url, selector, out_dir, viewports=DEFAULT_VIEWPORTS, use_cache=True, check=True,
                fonts=False, replay=None):
    """fonts=True embeds the page's own font files (only for fonts you're licensed to use).
    replay: a capture.Replay for offline, repeatable runs (tests)."""
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    async with domain_lock(url):
        captures = await capture(browser, url, selector, viewports, out_dir, use_cache, replay)
        font_files = await download_fonts(browser, await font_urls(browser, captures), url, replay) if fonts else {}
    built = await compile_captures(browser, captures, url, fonts=fonts, fontFiles=font_files)
    html_path = out_dir / 'index.html'
    html_path.write_text(built['doc'], encoding='utf-8')
    astro_path = out_dir / f'{built["astroName"]}.astro'
    astro_path.write_text(built['astro'], encoding='utf-8')
    (out_dir / 'theme.css').write_text(built['themeFile'], encoding='utf-8')
    report = await verify(browser, html_path, out_dir, viewports, replay=replay) if check else {}
    return {'html_path': str(html_path), 'astro_path': str(astro_path), 'fragment': built['fragment'],
            'astro': built['astro'], 'theme': built['theme'], 'report': report, 'doc': built['doc']}
