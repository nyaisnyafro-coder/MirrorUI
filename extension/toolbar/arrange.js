// Arrange: click an element to delete it, drag it to move it before or after another one (anywhere in the
// page), ↑/↓ to reach the parent or child, Ctrl/⌘+Z to undo. Handy for mocking up a layout before Pick or
// Clone page captures it. Changes live in this tab until reload.
(() => {
  const { h, button } = MUI;
  const DRAG_START = 5; // px of movement before a press becomes a drag

  let panel = null;
  let ops = [];        // {type: 'delete'|'move', el, parent, next, label, to?}
  let hovered = null;
  let press = null;    // {el, x, y}
  let drag = null;     // {el, target, before, offsetX, offsetY}

  const label = (el) => MUI.describe(el);
  const ownsPoint = (e) => MUI.ours(e);

  // ---------------------------------------------------------------- hover

  function hover(el) {
    hovered = el;
    if (!el) { MUI.hideBox('hover'); MUI.hideTip(); return; }
    const r = el.getBoundingClientRect();
    MUI.placeBox('hover', r, 'delete');
    MUI.tip([h('b', { text: label(el) }), ' ', h('span', { class: 'acc', text: `${Math.round(r.width)} × ${Math.round(r.height)}` }),
      h('div', { class: 'dim', text: 'Click to delete · drag to move · ↑ parent · ↓ child' })], r);
  }

  // ---------------------------------------------------------------- drop target

  // Where the dragged element would go: before or after the element under the cursor, along the axis its
  // parent lays children out on (left/right in a flex row, above/below otherwise).
  function dropAt(x, y) {
    const under = MUI.elementAt(x, y);
    if (!under || under === document.body || drag.el.contains(under)) return null;
    const target = under;
    const parent = target.parentElement;
    if (!parent) return null;
    const pcs = getComputedStyle(parent);
    const row = /flex/.test(pcs.display) && pcs.flexDirection.startsWith('row')
      || /grid/.test(pcs.display) && target.getBoundingClientRect().width < parent.getBoundingClientRect().width * 0.9;
    const r = target.getBoundingClientRect();
    const before = row ? x < r.left + r.width / 2 : y < r.top + r.height / 2;
    return { target, before, row, rect: r };
  }

  function showDrop(d) {
    if (!d) { MUI.hideBox('drop-line'); return; }
    const { rect: r, before, row } = d;
    const line = row
      ? { left: (before ? r.left : r.right) - 2, top: r.top, width: 4, height: r.height }
      : { left: r.left, top: (before ? r.top : r.bottom) - 2, width: r.width, height: 4 };
    MUI.placeBox('drop-line', line, 'drop-line');
  }

  // ---------------------------------------------------------------- operations

  function remove(el) {
    ops.push({ type: 'delete', el, parent: el.parentNode, next: el.nextSibling, label: label(el) });
    el.remove();
    hover(null);
    render();
  }

  function move(el, target, before) {
    const op = { type: 'move', el, parent: el.parentNode, next: el.nextSibling, label: label(el),
      to: `${before ? 'before' : 'after'} ${label(target)}` };
    if (before) target.before(el); else target.after(el);
    if (op.parent === el.parentNode && op.next === el.nextSibling) return; // dropped where it was
    ops.push(op);
    render();
  }

  function undo() {
    const op = ops.pop();
    if (!op) return;
    op.parent.insertBefore(op.el, op.next && op.next.parentNode === op.parent ? op.next : null);
    MUI.flash([op.el], 1200);
    render();
  }

  // ---------------------------------------------------------------- events

  const swallow = (e) => { e.preventDefault(); e.stopPropagation(); };

  const onMove = (e) => {
    if (drag) {
      swallow(e);
      MUI.placeBox('drag-ghost', { left: e.clientX - drag.offsetX, top: e.clientY - drag.offsetY, width: drag.w, height: drag.h }, 'drag-source');
      drag.drop = dropAt(e.clientX, e.clientY);
      showDrop(drag.drop);
      return;
    }
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > DRAG_START) {
      const r = press.el.getBoundingClientRect();
      drag = { el: press.el, offsetX: press.x - r.left, offsetY: press.y - r.top, w: r.width, h: r.height, drop: null };
      MUI.trackBox('drag-from', press.el, 'drag-source');
      MUI.hideBox('hover');
      MUI.hideTip();
      MUI.hint('Drop to move · Esc cancel');
      return;
    }
    if (ownsPoint(e)) { hover(null); return; }
    const el = MUI.elementAt(e.clientX, e.clientY);
    if (el !== hovered && el !== document.body) hover(el);
  };

  const onDown = (e) => {
    if (ownsPoint(e) || e.button !== 0) return;
    swallow(e);
    if (hovered) press = { el: hovered, x: e.clientX, y: e.clientY };
  };

  const endDrag = () => {
    drag = null;
    press = null;
    MUI.hideBox('drag-ghost');
    MUI.hideBox('drag-from');
    MUI.hideBox('drop-line');
    MUI.hint(HINT);
  };

  const onUp = (e) => {
    if (ownsPoint(e)) return;
    swallow(e);
    if (drag) {
      const d = drag.drop, el = drag.el;
      endDrag();
      if (d) move(el, d.target, d.before);
    } else if (press) {
      const el = press.el;
      press = null;
      remove(el);
    }
  };

  const onKey = (e) => {
    if (MUI.typingInUI(e)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { swallow(e); undo(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && hovered) { swallow(e); remove(hovered); }
    else if (e.key === 'ArrowUp' && hovered?.parentElement && hovered.parentElement !== document.body) { swallow(e); hover(hovered.parentElement); }
    else if (e.key === 'ArrowDown' && hovered?.firstElementChild) { swallow(e); hover(hovered.firstElementChild); }
  };

  const EVENTS = [['mousemove', onMove], ['mousedown', onDown], ['mouseup', onUp], ['click', (e) => { if (!ownsPoint(e)) swallow(e); }],
    ['dblclick', (e) => { if (!ownsPoint(e)) swallow(e); }], ['keydown', onKey], ['dragstart', (e) => { if (!ownsPoint(e)) swallow(e); }]];
  const HINT = 'Click to delete · drag to move · Ctrl+Z undo · Esc done';

  // ---------------------------------------------------------------- panel

  function render() {
    if (!panel) return;
    panel.setSubtitle(ops.length ? `${ops.length} ${ops.length === 1 ? 'change' : 'changes'} on this page` : 'Delete or move elements');
    panel.setActions([
      button('Undo', { icon: 'undo', onclick: undo, title: 'Ctrl/⌘ + Z' }),
      button('Reset all', { onclick: () => { while (ops.length) undo(); } }),
    ]);
    panel.setBody(ops.length ? [...ops].reverse().map((op) => h('div', { class: 'edit-row' },
      h('div', { class: 'small' }, h('b', { text: op.type === 'delete' ? 'Deleted ' : 'Moved ' }), op.label),
      op.to ? h('div', { class: 'muted small', text: op.to }) : null))
      : h('div', { class: 'empty' }, h('p', { text: 'Click an element to delete it, or drag it somewhere else.' }),
        h('p', { class: 'small', text: 'Use it to try a layout before cloning: Pick and Clone page capture the page as you arranged it. Reloading the page brings the original back.' })));
  }

  function start() {
    panel = MUI.panel({ title: 'Arrange', subtitle: '' });
    for (const [type, fn] of EVENTS) document.addEventListener(type, fn, true);
    MUI.onReposition = () => { if (hovered?.isConnected) MUI.placeBox('hover', hovered.getBoundingClientRect(), 'delete'); };
    MUI.hint(HINT);
    MUI.escape = () => { if (drag || press) endDrag(); else MUI.activate(null); };
    render();
  }

  function stop() {
    for (const [type, fn] of EVENTS) document.removeEventListener(type, fn, true);
    if (drag || press) endDrag();
    hover(null);
    MUI.onReposition = null;
    MUI.escape = null;
    MUI.hint(null);
    panel = null;
  }

  MUI.tools.arrange = { label: 'Arrange', icon: 'arrange', title: 'Delete or move elements', start, stop };
})();
