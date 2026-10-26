// Responsive: lay the tab out at a device size (phones with touch and a 2× screen) right where it is, or take
// a screenshot at every size. Uses the service worker's debugger session; closing the tool returns the tab
// to its own size.
(() => {
  const { h, button } = MUI;
  const DEVICES = [
    { label: 'Phone', width: 375, height: 812, mobile: true },
    { label: 'Large phone', width: 430, height: 932, mobile: true },
    { label: 'Tablet', width: 768, height: 1024, mobile: true },
    { label: 'Tablet landscape', width: 1024, height: 768, mobile: true },
    { label: 'Laptop', width: 1280, height: 800, mobile: false },
    { label: 'Desktop', width: 1440, height: 900, mobile: false },
  ];
  let panel = null;
  let live = null;
  let shots = [];
  let busy = false;
  let full = false;
  let expanded = false; // while a size is shown the panel shrinks to its header so the page stays visible

  const same = (a, b) => a && b && a.width === b.width && a.height === b.height && !!a.mobile === !!b.mobile;

  async function setLive(size) {
    live = size;
    expanded = false;
    render();
    await MUI.send(size ? { type: 'emulate', size } : { type: 'emulate-reset' });
  }

  async function captureAll() {
    busy = true;
    render();
    MUI.hideUI(true);
    try {
      const res = await MUI.send({ type: 'shots', sizes: DEVICES.map(({ label, width, height, mobile }) => ({ label, width, height, mobile })), full });
      shots = res.shots || [];
      if (res.error) MUI.toast(res.error);
    } finally {
      MUI.hideUI(false);
      busy = false;
      render();
    }
  }

  const name = (s) => `${location.hostname}-${s.width}x${s.height}${full ? '-full' : ''}.png`;
  const blobOf = async (dataUrl) => (await fetch(dataUrl)).blob();

  function render() {
    if (!panel) return;
    const custom = { w: h('input', { type: 'text', value: live ? live.width : 390, spellcheck: 'false' }),
      hgt: h('input', { type: 'text', value: live ? live.height : 844, spellcheck: 'false' }) };
    const mobile = h('input', { type: 'checkbox' });
    mobile.checked = live ? !!live.mobile : true;
    const fullBox = h('input', { type: 'checkbox' });
    fullBox.checked = full;
    fullBox.addEventListener('change', () => { full = fullBox.checked; });
    panel.setSubtitle(live ? `Showing ${live.width} × ${live.height}${live.mobile ? ' · touch' : ''}` : 'Showing the window’s own size');
    const compact = !!live && !expanded;
    panel.setCompact(compact);
    panel.setActions([
      button('Own size', { pressed: !live, onclick: () => setLive(null), title: 'Back to the browser window’s size' }),
      live ? button(expanded ? 'Hide devices' : 'Devices', { icon: 'responsive', onclick: () => { expanded = !expanded; render(); },
        title: expanded ? 'Shrink the panel to see the page' : 'Show the device list' }) : null,
      h('div', { class: 'spacer' }),
      compact ? null : button(busy ? 'Capturing…' : 'Capture all sizes', { icon: 'capture', primary: true, onclick: busy ? null : captureAll }),
    ]);
    panel.setBody([
      h('div', { class: 'devices' }, DEVICES.map((d) => h('button', {
        class: 'device', 'aria-pressed': String(same(d, live)), onclick: () => setLive(d),
      }, h('b', { text: d.label }), h('span', { text: `${d.width} × ${d.height}${d.mobile ? ' · touch' : ''}` })))),
      h('div', { class: 'section', text: 'Custom size' }),
      h('div', { class: 'row' }, h('div', { style: { width: '80px' } }, custom.w), '×', h('div', { style: { width: '80px' } }, custom.hgt),
        h('label', { class: 'check' }, mobile, 'Touch'),
        button('Show', { onclick: () => {
          const width = Math.max(240, Math.min(3840, +custom.w.value || 0)), height = Math.max(240, Math.min(3000, +custom.hgt.value || 0));
          if (width && height) setLive({ label: 'Custom', width, height, mobile: mobile.checked });
        } })),
      h('div', { class: 'section', text: 'Screenshots' }),
      h('label', { class: 'check' }, fullBox, 'Whole page, not just the first screen'),
      shots.length ? [h('div', { class: 'row', style: { margin: '10px 0' } },
        button('Download all', { icon: 'download', onclick: async () => { for (const s of shots) MUI.download(name(s), await blobOf(s.data)); } })),
      h('div', { class: 'shots' }, shots.map((s) => h('div', { class: 'shot' },
        h('img', { src: s.data, alt: `${s.label} screenshot` }),
        h('div', { class: 'meta' }, h('span', { text: `${s.label} · ${s.width}` }),
          h('button', { class: 'btn ghost', title: 'Download', onclick: async () => MUI.download(name(s), await blobOf(s.data)) }, MUI.icon('download'))))))]
        : h('p', { class: 'muted small', text: 'Takes one screenshot per device size. The tab is shown at each size for a moment.' }),
    ]);
  }

  // the user closed the debugging bar: the tab is back at its own size
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'debugger-detached' && live) { live = null; render(); }
  });

  function start() {
    panel = MUI.panel({ title: 'Responsive', subtitle: '' });
    render();
  }

  function stop() {
    if (live) MUI.send({ type: 'emulate-reset' });
    live = null;
    panel = null;
  }

  MUI.tools.responsive = { label: 'Responsive', icon: 'responsive', title: 'Preview and screenshot device sizes', start, stop };
})();
