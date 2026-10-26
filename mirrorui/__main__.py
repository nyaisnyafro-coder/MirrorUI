"""python -m mirrorui URL SELECTOR [-o out] [--viewports 375,768,1280] [--no-cache] [--no-verify]"""
import argparse
import asyncio

from playwright.async_api import async_playwright

from .capture import DEFAULT_VIEWPORTS, CaptureError
from .pipeline import clone


async def main():
    ap = argparse.ArgumentParser(prog='mirrorui', description='Clone one element of a page into Tailwind HTML.')
    ap.add_argument('url')
    ap.add_argument('selector')
    ap.add_argument('-o', '--out', default='out')
    ap.add_argument('--viewports', default=','.join(map(str, DEFAULT_VIEWPORTS)))
    ap.add_argument('--no-cache', action='store_true')
    ap.add_argument('--no-verify', action='store_true')
    ap.add_argument('--fonts', action='store_true',
                    help="embed the page's own font files (only for fonts you're licensed to use)")
    args = ap.parse_args()
    viewports = sorted(int(v) for v in args.viewports.split(','))

    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        try:
            result = await clone(browser, args.url, args.selector, args.out, viewports,
                                 use_cache=not args.no_cache, check=not args.no_verify, fonts=args.fonts)
        except CaptureError as e:
            raise SystemExit(f'error: {e}')
        finally:
            await browser.close()

    print(f'wrote {result["html_path"]} and {result["astro_path"]}')
    for width, r in result['report'].items():
        print(f'  {width}px: {r["diff"]:.1%} pixels differ  (original {r["size_a"]}, clone {r["size_b"]})')


asyncio.run(main())
