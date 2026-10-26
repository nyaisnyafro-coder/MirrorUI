// Capture: screenshot the visible area, the whole page, one element, or a dragged region. Visible area,
// regions and elements that fit on screen use the browser's tab capture (no debugging bar); the whole page
// and taller elements go through the service worker's debugger session. Result: preview, download, copy.
(() => {
  const { h, button } = MUI;
  let panel = null;
  let result = null; // {data, name, w, h}
  let stopSelect = null;
  let region = null;

  const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

  // Cut a viewport rect out of a tab capture, which is in device pixels.
  async function crop(dataUrl, rect) {
    const img = await loadImage(dataUrl);
    const scale = img.naturalWidth / innerWidth;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(rect.width * scale);
    canvas.height = Math.round(rect.height * scale);
    canvas.getContext('2d').drawImage(img, rect.left * scale, rect.top * scale, rect.width * scale, rect.height * scale,
      0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  }

  async function shoot(mode, rect) {
    panel.setBody(h('div', { class: 'empty', text: 'Capturing…' }));
    await MUI.hideUI(true);
    let res;
    try {
      const fits = rect && rect.top >= 0 && rect.left >= 0 && rect.bottom <= innerHeight && rect.right <= innerWidth;
      if (mode === 'full') res = await MUI.send({ type: 'screenshot', mode: 'full' });
      else if (mode === 'visible' || fits) {
        res = await MUI.send({ type: 'screenshot', mode: 'visible' });
        if (res.data && rect) res.data = await crop(res.data, rect);
      } else {
        res = await MUI.send({ type: 'screenshot', mode: 'clip',
          clip: { x: rect.left + scrollX, y: rect.top + scrollY, width: rect.width, height: rect.height } });
      }
    } finally {
      await MUI.hideUI(false);
    }
    if (!res || res.error || !res.data) {
      panel.setBody(h('div', { class: 'error', text: `Screenshot failed: ${res ? res.error || 'no image' : 'no answer'}` }));
      return;
    }
    const img = await loadImage(res.data);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    result = { data: res.data, name: `${location.hostname}-${mode}-${stamp}.png`, w: img.naturalWidth, h: img.naturalHeight };
    render();
  }

  function pickElement() {
    stopSelect = MUI.select({
      hint: 'Click an element to screenshot it · Esc cancel',
      onHover: (el) => {
        const r = el.getBoundingClientRect();
        MUI.tip([h('b', { text: MUI.describe(el) }), ' ', h('span', { class: 'acc', text: `${Math.round(r.width)} × ${Math.round(r.height)}` })], r);
      },
      onPick: (el) => {
        stopSelect();
        stopSelect = null;
        shoot('element', el.getBoundingClientRect());
      },
    });
  }

  // drag a rectangle over the page
  function pickRegion() {
    MUI.hint('Drag to select a region · Esc cancel');
    const sel = h('div', { class: 'sel', hidden: true });
    const label = h('div', { class: 'dim-label', hidden: true });
    region = h('div', { class: 'region' }, sel, label);
    MUI.layer(region);
    let start = null;
    const rectOf = (e) => ({
      left: Math.min(start.x, e.clientX), top: Math.min(start.y, e.clientY),
      width: Math.abs(e.clientX - start.x), height: Math.abs(e.clientY - start.y),
    });
    region.addEventListener('mousedown', (e) => { start = { x: e.clientX, y: e.clientY }; e.preventDefault(); });
    region.addEventListener('mousemove', (e) => {
      if (!start) return;
      const r = rectOf(e);
      sel.hidden = label.hidden = false;
      Object.assign(sel.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
      label.textContent = `${Math.round(r.width)} × ${Math.round(r.height)}`;
      Object.assign(label.style, { left: `${r.left}px`, top: `${Math.max(0, r.top - 20)}px` });
    });
    region.addEventListener('mouseup', (e) => {
      if (!start) return;
      const r = rectOf(e);
      endRegion();
      if (r.width > 4 && r.height > 4) shoot('region', { ...r, right: r.left + r.width, bottom: r.top + r.height });
    });
    MUI.escape = endRegion;
  }

  function endRegion() {
    region?.remove();
    region = null;
    MUI.hint(null);
    if (MUI.escape === endRegion) MUI.escape = null;
  }

  async function copyImage() {
    try {
      const blob = await (await fetch(result.data)).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      MUI.toast('Image copied');
    } catch {
      MUI.toast('The browser blocked copying the image; use Download');
    }
  }

  function render() {
    panel.setActions([
      button('Visible', { icon: 'image', onclick: () => shoot('visible'), title: 'What’s on screen now' }),
      button('Full page', { icon: 'responsive', onclick: () => shoot('full'), title: 'The whole page, top to bottom' }),
      button('Element', { icon: 'pick', onclick: pickElement }),
      button('Region', { icon: 'inspect', onclick: pickRegion, title: 'Drag a rectangle' }),
    ]);
    panel.setBody(result ? h('div', { class: 'result' },
      h('div', { class: 'row', style: { marginBottom: '10px' } },
        h('span', { class: 'muted small', text: `${result.w} × ${result.h} px` }), h('div', { class: 'spacer' }),
        button('Copy', { icon: 'copy', onclick: copyImage }),
        button('Download', { icon: 'download', primary: true, onclick: async () => MUI.download(result.name, await (await fetch(result.data)).blob()) })),
      h('img', { src: result.data, alt: 'Screenshot' }))
      : h('div', { class: 'empty' }, h('p', { text: 'Choose what to capture above.' }),
        h('p', { class: 'small', text: 'The toolbar is hidden while the screenshot is taken.' })));
  }

  function start() {
    result = null;
    panel = MUI.panel({ title: 'Capture', subtitle: 'Screenshots of this page' });
    render();
  }

  function stop() {
    stopSelect?.();
    stopSelect = null;
    endRegion();
    panel = null;
  }

  MUI.tools.capture = { label: 'Capture', icon: 'capture', title: 'Screenshot the page, an element or a region', start, stop };
})();
