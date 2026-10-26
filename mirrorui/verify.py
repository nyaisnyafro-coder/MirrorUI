"""Render the generated HTML at each viewport and compare it with the original screenshot."""
import base64
from pathlib import Path

from playwright.async_api import Browser, TimeoutError as PWTimeout

from .capture import snap

# Pixel diff runs in the browser so we don't need Pillow/numpy.
DIFF_JS = """async ([a, b]) => {
  const load = (src) => new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = src; });
  const [ia, ib] = await Promise.all([load(a), load(b)]);
  const w = Math.max(ia.width, ib.width), h = Math.max(ia.height, ib.height);
  const px = (img) => { const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0);
    return g.getImageData(0, 0, w, h).data; };
  const da = px(ia), db = px(ib);
  let diff = 0;
  for (let i = 0; i < da.length; i += 4) {
    if (Math.abs(da[i] - db[i]) + Math.abs(da[i+1] - db[i+1]) + Math.abs(da[i+2] - db[i+2]) > 48) diff++;
  }
  return { diff: diff / (w * h), size_a: [ia.width, ia.height], size_b: [ib.width, ib.height] };
}"""


def data_url(path):
    return 'data:image/png;base64,' + base64.b64encode(Path(path).read_bytes()).decode()


async def verify(browser: Browser, target, out_dir, viewports, label='clone'):
    """target: generated HTML file, or the URL of a page that wraps the component in #mirrorui-frame."""
    out_dir = Path(out_dir)
    url = target if str(target).startswith('http') else Path(target).resolve().as_uri()
    report = {}
    for width in viewports:
        ctx = await browser.new_context(viewport={'width': width, 'height': 900}, device_scale_factor=1)
        try:
            page = await ctx.new_page()
            await page.goto(url, wait_until='load', timeout=60_000)
            try:
                await page.wait_for_load_state('networkidle', timeout=10_000)
            except PWTimeout:
                pass  # remote images still trickling in; compare what's there
            await page.evaluate('document.fonts.ready.then(() => true)')
            clone_shot = out_dir / f'{label}-{width}.png'
            box = await page.evaluate("""() => { const r = document.querySelector('#mirrorui-frame > *').getBoundingClientRect();
                return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; }""")
            original = out_dir / f'original-{width}.png'
            if box['width'] < 1 or box['height'] < 1:
                clone_shot.unlink(missing_ok=True)  # no box of its own at this width, like the original
                continue
            await page.screenshot(path=str(clone_shot), clip=snap(box), full_page=True, animations='disabled')
            if original.exists():
                report[width] = await page.evaluate(DIFF_JS, [data_url(original), data_url(clone_shot)])
        finally:
            await ctx.close()
    return report
