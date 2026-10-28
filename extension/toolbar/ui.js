// Shell of the in-page UI: a shadow root holding the toolbar, the side panel, hover highlights, tooltip,
// hint and toast, plus the hover-to-select mode Pick and Inspect share. Tools register themselves in
// MUI.tools ({label, icon, start(), stop()}); main.js mounts the shell.
(() => {
  if (globalThis.MUI) return;
  const MUI = (globalThis.MUI = { tools: {}, order: [], mounted: false });
  const SVG = 'http://www.w3.org/2000/svg';

  // Icons as element specs (24×24, stroked), built with createElementNS: no innerHTML, so pages that
  // enforce Trusted Types can't block them.
  const ICONS = {
    logo: [['rect', { x: 2, y: 2, width: 20, height: 20, rx: 5, fill: '#1b1530', stroke: 'none' }],
      ['rect', { x: 5, y: 6, width: 8, height: 12, rx: 2, fill: '#7c5cff', stroke: 'none' }],
      ['rect', { x: 11, y: 6, width: 8, height: 12, rx: 2, fill: '#ece9f4', stroke: 'none' }]],
    pick: [['path', { d: 'M4 4l7 17 2.5-7.5L21 11z' }], ['path', { d: 'M14 14l5 5' }]],
    inspect: [['rect', { x: 3, y: 3, width: 18, height: 18, rx: 2 }], ['path', { d: 'M3 9h4M3 15h4M9 3v4M15 3v4' }]],
    colors: [['path', { d: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z' }]],
    fonts: [['path', { d: 'M4 19l5-14 5 14M6 14h6' }], ['path', { d: 'M16 12.5a3 3 0 1 1 0 4.5V19M19 11v8' }]],
    assets: [['rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }], ['circle', { cx: 9, cy: 10, r: 2 }],
      ['path', { d: 'M21 16l-5-5-9 9' }]],
    minimize: [['path', { d: 'M5 12h14' }]],
    close: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
    copy: [['rect', { x: 9, y: 9, width: 11, height: 11, rx: 2 }], ['path', { d: 'M5 15V5a1 1 0 0 1 1-1h9' }]],
    download: [['path', { d: 'M12 4v11M7 10l5 5 5-5M5 20h14' }]],
    external: [['path', { d: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5' }]],
    refresh: [['path', { d: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6' }]],
    eyedropper: [['path', { d: 'M14 4l6 6M17 7l-9 9-3 1 1-3 9-9' }]],
    up: [['path', { d: 'M12 19V5M6 11l6-6 6 6' }]],
    target: [['circle', { cx: 12, cy: 12, r: 8 }], ['circle', { cx: 12, cy: 12, r: 2 }]],
    clone: [['rect', { x: 8, y: 8, width: 12, height: 12, rx: 2 }], ['path', { d: 'M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3' }]],
    design: [['path', { d: 'M6 3h9l4 4v14H6z' }], ['path', { d: 'M15 3v4h4M9 12h7M9 16h7' }]],
    responsive: [['rect', { x: 2, y: 5, width: 14, height: 10, rx: 1 }], ['path', { d: 'M6 19h6' }],
      ['rect', { x: 17, y: 9, width: 5, height: 10, rx: 1 }]],
    capture: [['path', { d: 'M4 8h3l2-3h6l2 3h3v11H4z' }], ['circle', { cx: 12, cy: 13, r: 3.5 }]],
    edit: [['path', { d: 'M5 6V4h12v2M11 4v15M8 19h6' }], ['path', { d: 'M17 13l3 3-4 4h-3v-3z' }]],
    undo: [['path', { d: 'M9 14L4 9l5-5' }], ['path', { d: 'M4 9h10a6 6 0 0 1 0 12h-2' }]],
    image: [['rect', { x: 3, y: 4, width: 18, height: 16, rx: 2 }], ['path', { d: 'M3 16l5-5 4 4 3-3 6 6' }]],
    swap: [['path', { d: 'M4 8h13l-3-3M20 16H7l3 3' }]],
    arrange: [['path', { d: 'M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3' }]],
  };

  MUI.icon = (name) => {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'i');
    for (const [tag, attrs] of ICONS[name]) {
      const node = document.createElementNS(SVG, tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      svg.append(node);
    }
    return svg;
  };

  // h('button', {class: 'btn', onclick: fn, title: '…'}, child, 'text', [more]) -> element
  MUI.h = (tag, attrs = {}, ...kids) => {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      // only the user's clicks: some pages re-dispatch a synthetic copy of every click, which would toggle a
      // tool straight back off
      if (k === 'onclick') el.addEventListener('click', (e) => { if (e.isTrusted) v(e); });
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'text') el.textContent = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return el;
  };
  const { h } = MUI;

  MUI.button = (label, { icon, onclick, primary, title, pressed } = {}) => h('button', {
    class: `btn${primary ? ' primary' : ''}`, onclick, title, 'aria-pressed': pressed === undefined ? null : String(pressed),
  }, icon ? MUI.icon(icon) : null, label);

  MUI.send = (msg) => chrome.runtime.sendMessage(msg);

  MUI.describe = (el) => {
    const cls = [...el.classList].filter((c) => !c.startsWith('mirrorui')).slice(0, 2).map((c) => `.${c}`).join('');
    return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls}`;
  };

  MUI.hex = (color) => {
    const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(color || '');
    if (!m) return null;
    const a = m[4] === undefined ? 1 : +m[4];
    const hx = (n) => Math.round(+n).toString(16).padStart(2, '0');
    return `#${hx(m[1])}${hx(m[2])}${hx(m[3])}${a < 1 ? hx(a * 255) : ''}`;
  };

  // ---------------------------------------------------------------- mount

  let host, shadow, root, bar, mini, panelEl, modalEl, hintEl, toastEl, tipEl, toastTimer;
  const boxes = new Map();   // key -> element
  const tracked = new Map(); // key -> {el, cls}: boxes that follow an element on scroll/resize

  MUI.mount = () => {
    if (MUI.mounted) return;
    host = document.createElement('mirrorui-root');
    host.setAttribute('style', 'all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;');
    shadow = host.attachShadow({ mode: 'open' });
    shadow.append(h('style', { text: globalThis.MirrorUIStyles }));
    root = h('div', { class: 'mui' });
    tipEl = h('div', { class: 'tip', hidden: true });
    hintEl = h('div', { class: 'hint', hidden: true });
    toastEl = h('div', { class: 'toast', hidden: true });
    panelEl = h('div', { hidden: true });
    modalEl = h('div', { hidden: true });

    const toolButtons = MUI.order.map((name) => {
      const t = MUI.tools[name];
      t.button = h('button', { class: 'tool', 'aria-pressed': 'false', title: t.title || t.label, onclick: () => MUI.activate(name) },
        MUI.icon(t.icon), t.label);
      return t.button;
    });
    bar = h('div', { class: 'bar' },
      h('div', { class: 'brand', title: 'MirrorUI' }, MUI.icon('logo')),
      toolButtons,
      h('div', { class: 'sep' }),
      h('button', { class: 'tool square', title: 'Minimize', onclick: () => MUI.minimize(true) }, MUI.icon('minimize')),
      h('button', { class: 'tool square', title: 'Close MirrorUI (Alt+Shift+M)', onclick: () => MUI.unmount() }, MUI.icon('close')));
    mini = h('button', { class: 'mini', hidden: true, title: 'Show MirrorUI', onclick: () => MUI.minimize(false) }, MUI.icon('logo'));

    root.append(panelEl, modalEl, tipEl, hintEl, toastEl, bar, mini);
    shadow.append(root);
    document.documentElement.append(host);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('keydown', onKey, true);
    MUI.host = host;
    MUI.mounted = true;
  };

  MUI.unmount = () => {
    if (!MUI.mounted) return;
    MUI.activate(null);
    window.removeEventListener('scroll', reposition, true);
    window.removeEventListener('resize', reposition);
    window.removeEventListener('keydown', onKey, true);
    host.remove();
    boxes.clear();
    tracked.clear();
    MUI.mounted = false;
  };

  MUI.toggle = () => (MUI.mounted ? MUI.unmount() : MUI.mount());

  // Keeps our own UI out of screenshots; resolves once the page has repainted without it.
  MUI.hideUI = (on) => {
    host.style.visibility = on ? 'hidden' : '';
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  };

  MUI.minimize = (on) => {
    if (on) MUI.activate(null);
    bar.hidden = on;
    mini.hidden = !on;
  };

  const onKey = (e) => {
    // Alt+Shift+M also reaches the page when the toolbar has focus; the command handles it, so ignore here
    if (e.key === 'Escape' && MUI.escape) {
      MUI.escape();
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // ---------------------------------------------------------------- tools

  MUI.active = null;
  MUI.activate = (name) => {
    const prev = MUI.active;
    if (prev) {
      MUI.tools[prev].stop?.();
      MUI.tools[prev].button.setAttribute('aria-pressed', 'false');
    }
    MUI.closePanel();
    modalClose = null; // the tool is already stopping
    MUI.closeModal();
    MUI.clearBoxes();
    MUI.hideTip();
    MUI.hint(null);
    MUI.active = null;
    if (!name || name === prev) return; // clicking the active tool turns it off
    MUI.active = name;
    MUI.tools[name].button.setAttribute('aria-pressed', 'true');
    MUI.tools[name].start();
  };

  // ---------------------------------------------------------------- panel

  // ---------------------------------------------------------------- dragging

  // Panels and the result window move by their header. Where each kind was left is remembered across pages;
  // double-clicking the header puts it back in its default spot.
  let positions = {};
  chrome.storage.local.get('positions').then((r) => { positions = r.positions || {}; });
  const savePositions = () => chrome.storage.local.set({ positions }).catch(() => {});

  const place = (el, pos) => {
    if (!pos) {
      el.style.left = el.style.top = '';
      el.classList.remove('moved');
      return;
    }
    el.classList.add('moved');
    const r = el.getBoundingClientRect();
    // keep the header reachable
    const x = Math.min(Math.max(0, pos.x), innerWidth - Math.min(r.width, 160));
    const y = Math.min(Math.max(0, pos.y), innerHeight - 56);
    Object.assign(el.style, { left: `${x}px`, top: `${y}px` });
  };

  MUI.dragging = false;
  MUI.draggable = (el, handle, kind) => {
    requestAnimationFrame(() => place(el, positions[kind]));
    handle.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('button, input, select, textarea, a, label')) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const dx = e.clientX - r.left, dy = e.clientY - r.top;
      MUI.dragging = true;
      const move = (ev) => { ev.stopPropagation(); place(el, { x: ev.clientX - dx, y: ev.clientY - dy }); };
      const up = () => {
        removeEventListener('mousemove', move, true);
        removeEventListener('mouseup', up, true);
        const rr = el.getBoundingClientRect();
        positions[kind] = { x: rr.left, y: rr.top };
        savePositions();
        // the click that ends a drag must not reach a tool's select mode
        setTimeout(() => { MUI.dragging = false; }, 0);
      };
      addEventListener('mousemove', move, true);
      addEventListener('mouseup', up, true);
    });
    handle.addEventListener('dblclick', (e) => {
      if (e.target.closest('button, input')) return;
      delete positions[kind];
      savePositions();
      place(el, null);
    });
  };

  // ---------------------------------------------------------------- side panel

  // panel({title, subtitle, actions: [nodes], body: node})
  //   -> {body, setSubtitle, setActions, setBody, setCompact(on)}; compact shows only the header and actions
  MUI.panel = ({ title, subtitle = '', actions = null, body = null }) => {
    const sub = h('p', { text: subtitle });
    const actionsEl = h('div', { class: 'actions', hidden: !actions }, actions);
    const bodyEl = h('div', { class: 'body' }, body);
    const close = h('button', { class: 'btn ghost', title: 'Close panel', onclick: () => MUI.activate(null) }, MUI.icon('close'));
    const header = h('header', { title: 'Drag to move · double-click to put back' },
      h('div', { class: 'titles' }, h('h2', { text: title }), sub), close);
    const el = h('div', { class: 'panel' }, header, actionsEl, bodyEl);
    panelEl.replaceChildren(el);
    panelEl.hidden = false;
    MUI.draggable(el, header, 'panel');
    return {
      body: bodyEl,
      setSubtitle: (t) => { sub.textContent = t; },
      setActions: (nodes) => { actionsEl.replaceChildren(...[nodes].flat(Infinity).filter(Boolean)); actionsEl.hidden = !nodes; },
      setBody: (node) => bodyEl.replaceChildren(...[node].flat(Infinity).filter(Boolean)),
      setCompact: (on) => el.classList.toggle('compact', on),
    };
  };
  // full-screen layer above everything else, e.g. Capture's region selector
  MUI.layer = (el) => root.append(el);

  MUI.closePanel = () => {
    if (!panelEl) return;
    panelEl.replaceChildren();
    panelEl.hidden = true;
  };

  // ---------------------------------------------------------------- result window

  // A large window for results that need room (Pick and Clone page): header with controls, then any content.
  // modal({title, subtitle, controls: [nodes], body, onClose}) -> {body, setSubtitle, setControls, setBody, close}
  let modalClose = null;
  MUI.modal = ({ title, subtitle = '', controls = null, body = null, onClose = null }) => {
    const sub = h('p', { text: subtitle });
    const controlsEl = h('div', { class: 'controls' }, controls);
    const bodyEl = h('div', { class: 'mbody' }, body);
    const header = h('header', { title: 'Drag to move · double-click to put back' },
      h('div', { class: 'titles' }, h('h2', { text: title }), sub), controlsEl,
      h('button', { class: 'btn ghost', title: 'Close', onclick: () => MUI.closeModal() }, MUI.icon('close')));
    const el = h('div', { class: 'modal' }, header, bodyEl);
    modalEl.replaceChildren(el);
    modalEl.hidden = false;
    modalClose = onClose;
    MUI.draggable(el, header, 'modal');
    return {
      el,
      body: bodyEl,
      setSubtitle: (t) => { sub.textContent = t; },
      setControls: (nodes) => controlsEl.replaceChildren(...[nodes].flat(Infinity).filter(Boolean)),
      setBody: (node) => bodyEl.replaceChildren(...[node].flat(Infinity).filter(Boolean)),
    };
  };
  MUI.closeModal = () => {
    if (!modalEl || modalEl.hidden) return;
    modalEl.replaceChildren();
    modalEl.hidden = true;
    const cb = modalClose;
    modalClose = null;
    cb?.();
  };

  // ---------------------------------------------------------------- highlights, tooltip, hint, toast

  MUI.placeBox = (key, rect, cls = '') => {
    let el = boxes.get(key);
    if (!el) {
      el = h('div');
      boxes.set(key, el);
      root.prepend(el);
    }
    el.className = `box ${cls}`;
    Object.assign(el.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    el.hidden = false;
    return el;
  };
  // small text tag centred on (x, y), e.g. a distance on a measuring guide; shares the box registry
  MUI.placeLabel = (key, text, x, y) => {
    let el = boxes.get(key);
    if (!el) {
      el = h('div');
      boxes.set(key, el);
      root.prepend(el);
    }
    el.className = 'guide-label';
    el.textContent = text;
    Object.assign(el.style, { left: `${x}px`, top: `${y}px` });
    el.hidden = false;
    return el;
  };
  MUI.hideBox = (key) => {
    const el = boxes.get(key);
    if (el) el.hidden = true;
    tracked.delete(key);
  };
  MUI.clearBoxes = (prefix = '') => {
    for (const [key, el] of [...boxes]) {
      if (!key.startsWith(prefix)) continue;
      el.remove();
      boxes.delete(key);
      tracked.delete(key);
    }
  };
  // A box that stays on an element while the page scrolls or resizes.
  MUI.trackBox = (key, el, cls) => {
    tracked.set(key, { el, cls });
    MUI.placeBox(key, el.getBoundingClientRect(), cls);
  };

  let frame = 0;
  const reposition = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      for (const [key, { el, cls }] of tracked) {
        if (el.isConnected) MUI.placeBox(key, el.getBoundingClientRect(), cls);
        else MUI.hideBox(key);
      }
      MUI.onReposition?.();
    });
  };

  // Tooltip next to rect, kept inside the viewport.
  MUI.tip = (nodes, rect) => {
    tipEl.replaceChildren(...[nodes].flat(Infinity).filter(Boolean));
    tipEl.hidden = false;
    const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
    let top = rect.bottom + 8;
    if (top + th > innerHeight - 90) top = Math.max(8, rect.top - th - 8);
    if (top + th > innerHeight - 90) top = Math.max(8, innerHeight - 90 - th);
    const left = Math.min(Math.max(8, rect.left), innerWidth - tw - 8);
    Object.assign(tipEl.style, { left: `${left}px`, top: `${top}px` });
  };
  MUI.hideTip = () => { if (tipEl) tipEl.hidden = true; };

  MUI.hint = (text) => {
    if (!hintEl) return;
    hintEl.hidden = !text;
    hintEl.textContent = text || '';
  };

  MUI.toast = (text) => {
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 1600);
  };

  MUI.copy = async (text, what = 'Copied') => {
    try {
      await navigator.clipboard.writeText(text);
      MUI.toast(what);
    } catch {
      // clipboard blocked (no focus / permission): fall back to a temporary textarea
      const ta = h('textarea', { style: { position: 'fixed', opacity: '0' } });
      ta.value = text;
      shadow.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      MUI.toast(what);
    }
  };

  // Saves text or a Blob through a blob: URL (same-origin, so the download attribute is honoured).
  MUI.download = (name, data, type = 'text/plain') => {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  // ---------------------------------------------------------------- page scanning

  // Rendered elements in the page (not our UI), in document order, at most `limit` of them.
  MUI.visibleElements = function* visibleElements(limit = 6000) {
    let n = 0;
    for (const el of document.body.querySelectorAll('*')) {
      if (n++ >= limit) return;
      const r = el.getBoundingClientRect();
      if (r.width && r.height) yield el;
    }
  };
  MUI.hasOwnText = (el) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());

  // Outline up to 80 elements for a moment, e.g. everything using one colour or font.
  MUI.flash = (els, ms = 2500) => {
    MUI.clearBoxes('flash-');
    els.filter((el) => el.isConnected).slice(0, 80)
      .forEach((el, i) => MUI.trackBox(`flash-${i}`, el, 'other'));
    clearTimeout(MUI.flashTimer);
    MUI.flashTimer = setTimeout(() => MUI.clearBoxes('flash-'), ms);
  };

  // ---------------------------------------------------------------- hover-to-select mode

  MUI.ours = (e) => e.composedPath().includes(host);
  // a key typed into one of our own inputs (font search, sizes…), as opposed to a shortcut meant for the page:
  // focus usually sits on a toolbar button after a click, and shortcuts must still work then
  MUI.typingInUI = (e) => MUI.ours(e) && /^(INPUT|TEXTAREA|SELECT)$/.test(e.composedPath()[0].tagName || '');
  MUI.elementAt = (x, y) => {
    const el = document.elementFromPoint(x, y);
    return !el || el === host || el === document.documentElement ? null : el;
  };

  // select({hint, onHover(el, event), onPick(el), onLeave(), onEscape()}) -> stop(). Highlights the element
  // under the cursor; ↑/↓ walk to parent/child, click or Enter picks, Esc ends the mode (then onEscape).
  // The page doesn't get the clicks.
  MUI.select = ({ hint, onHover, onPick, onLeave, onEscape }) => {
    let current = null;
    const show = (el, e) => {
      current = el;
      MUI.placeBox('hover', el.getBoundingClientRect());
      onHover?.(el, e);
    };
    const swallow = (e) => {
      if (MUI.ours(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const move = (e) => {
      if (MUI.ours(e)) { MUI.hideBox('hover'); MUI.hideTip(); onLeave?.(); current = null; return; }
      const el = MUI.elementAt(e.clientX, e.clientY);
      if (el && (el !== current || e.altKey)) show(el, e);
    };
    const click = (e) => {
      if (MUI.ours(e)) return;
      swallow(e);
      if (current && !MUI.dragging && e.isTrusted) onPick(current); // (not a page's synthetic copy)
    };
    const key = (e) => {
      if (e.key === 'ArrowUp' && current?.parentElement && current.parentElement !== document.documentElement) show(current.parentElement, e);
      else if (e.key === 'ArrowDown' && current?.firstElementChild) show(current.firstElementChild, e);
      else if (e.key === 'Enter' && current) onPick(current);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    const refresh = () => { if (current?.isConnected) MUI.placeBox('hover', current.getBoundingClientRect()); };
    const BLOCK = ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'dblclick', 'contextmenu'];
    document.addEventListener('mousemove', move, true);
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key, true);
    for (const t of BLOCK) document.addEventListener(t, swallow, true);
    MUI.onReposition = refresh;
    MUI.hint(hint);
    const stop = () => {
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', key, true);
      for (const t of BLOCK) document.removeEventListener(t, swallow, true);
      MUI.hideBox('hover');
      MUI.hideTip();
      MUI.hint(null);
      if (MUI.escape === escape) MUI.escape = null;
      MUI.onReposition = null;
    };
    const escape = () => { stop(); onEscape?.(); };
    MUI.escape = escape;
    return stop;
  };
})();
