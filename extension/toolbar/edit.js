// Edit text: click any text on the page and type over it, to try out copy before cloning (Pick and Clone page
// capture the edited text). Esc or Enter finishes an edit, Shift+Enter adds a line, Ctrl/⌘+Z undoes the last
// edit. The panel lists every change with its own revert, and copies them as JSON. Changes live in this tab
// only; reloading the page brings the original back.
(() => {
  const { h, button } = MUI;
  let panel = null;
  let edits = [];      // {el, before: Node[], beforeText, afterText}
  let editing = null;  // {el, before, beforeText, hadAttr}
  let hovered = null;
  let active = false;

  // the element to edit under the cursor: the nearest one that holds text itself
  const textTarget = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) if (MUI.hasOwnText(e)) return e;
    return null;
  };

  function begin(el, e) {
    if (editing) finish();
    editing = { el, before: [...el.childNodes].map((n) => n.cloneNode(true)), beforeText: el.innerText,
      hadAttr: el.getAttribute('contenteditable') };
    el.setAttribute('contenteditable', 'plaintext-only');
    el.focus({ preventScroll: true });
    // caret where the user clicked
    const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (range && el.contains(range.startContainer)) {
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    MUI.trackBox('editing', el, 'editing');
    MUI.hideBox('hover');
    MUI.hint('Type to edit · Enter or Esc done · Shift+Enter new line');
  }

  function finish() {
    if (!editing) return;
    const { el, before, beforeText, hadAttr } = editing;
    if (hadAttr === null) el.removeAttribute('contenteditable'); else el.setAttribute('contenteditable', hadAttr);
    el.blur();
    editing = null;
    MUI.hideBox('editing');
    MUI.hint(active ? 'Click any text to edit · Ctrl+Z undo · Esc done' : null);
    const afterText = el.innerText;
    if (afterText !== beforeText) {
      const existing = edits.find((x) => x.el === el);
      if (existing) existing.afterText = afterText; // keep the very first original for revert
      else edits.push({ el, before, beforeText, afterText });
    }
    render();
  }

  function revert(edit) {
    edit.el.replaceChildren(...edit.before.map((n) => n.cloneNode(true)));
    edits = edits.filter((x) => x !== edit);
    render();
  }

  const undo = () => { if (edits.length) revert(edits[edits.length - 1]); };

  const ours = (e) => MUI.ours(e);
  const inEditing = (e) => editing && editing.el.contains(e.target);

  const onMove = (e) => {
    if (ours(e) || editing) return;
    const el = textTarget(MUI.elementAt(e.clientX, e.clientY));
    if (el === hovered) return;
    hovered = el;
    if (el) MUI.placeBox('hover', el.getBoundingClientRect());
    else MUI.hideBox('hover');
  };
  const onDown = (e) => {
    if (ours(e) || inEditing(e)) return; // clicks inside the edited text place the caret
    e.preventDefault();
    e.stopPropagation();
    if (editing) finish();
  };
  const onClick = (e) => {
    if (ours(e)) return;
    e.preventDefault(); // links don't navigate, buttons don't submit
    e.stopPropagation();
    if (inEditing(e) || MUI.dragging) return;
    const el = textTarget(MUI.elementAt(e.clientX, e.clientY));
    if (el) begin(el, e);
  };
  const onKey = (e) => {
    if (editing) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finish(); }
      e.stopPropagation(); // typing must not trigger the page's shortcuts
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !MUI.typingInUI(e)) {
      e.preventDefault();
      e.stopPropagation();
      undo();
    }
  };
  const EVENTS = [['mousemove', onMove], ['mousedown', onDown], ['click', onClick], ['keydown', onKey]];

  function render() {
    if (!panel) return;
    panel.setSubtitle(edits.length ? `${edits.length} ${edits.length === 1 ? 'change' : 'changes'} on this page` : 'Click any text on the page');
    panel.setActions([
      button('Undo', { icon: 'undo', onclick: undo, title: 'Ctrl/⌘ + Z' }),
      button('Reset all', { onclick: () => { [...edits].reverse().forEach(revert); } }),
      h('div', { class: 'spacer' }),
      button('Copy changes', {
        icon: 'copy',
        onclick: () => MUI.copy(JSON.stringify(edits.map((x) => ({ element: MUI.describe(x.el), before: x.beforeText, after: x.afterText })), null, 2), 'Changes copied as JSON'),
      }),
    ]);
    panel.setBody(edits.length ? edits.map((x) => h('div', { class: 'edit-row' },
      h('div', { class: 'row' }, h('span', { class: 'muted small', text: MUI.describe(x.el) }), h('div', { class: 'spacer' }),
        h('button', { class: 'btn ghost', title: 'Show', onclick: () => { x.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); MUI.flash([x.el]); } }, MUI.icon('target')),
        h('button', { class: 'btn ghost', title: 'Revert', onclick: () => revert(x) }, MUI.icon('undo'))),
      h('div', { class: 'before small', text: x.beforeText }),
      h('div', { class: 'after small', text: x.afterText })))
      : h('div', { class: 'empty' }, h('p', { text: 'Click any text on the page and type.' }),
        h('p', { class: 'small', text: 'Changes stay in this tab until you reload. Pick and Clone page capture the edited text, so you can try new copy before cloning.' })));
  }

  function start() {
    active = true;
    panel = MUI.panel({ title: 'Edit text', subtitle: '' });
    for (const [type, fn] of EVENTS) document.addEventListener(type, fn, true);
    MUI.hint('Click any text to edit · Ctrl+Z undo · Esc done');
    MUI.escape = () => { if (editing) finish(); else MUI.activate(null); };
    render();
  }

  function stop() {
    finish();
    active = false;
    for (const [type, fn] of EVENTS) document.removeEventListener(type, fn, true);
    MUI.hideBox('hover');
    MUI.escape = null;
    hovered = null;
    panel = null;
  }

  MUI.tools.edit = { label: 'Edit text', icon: 'edit', title: 'Edit any text on the page', start, stop };
})();
