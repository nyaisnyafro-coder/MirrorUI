// Original screenshot next to the live clone, both laid out at the captured viewport width and scaled to fit
// their containers. Used by the results page and the in-page Pick panel. The clone renders in preview.html,
// a sandboxed page with no extension APIs, because its markup comes from someone else's site.
globalThis.MirrorUIStage = (() => {
  const make = (tag, cls) => Object.assign(document.createElement(tag), { className: cls });

  // show(origBox, cloneBox, {capture, shot, doc, fit}) -> {layout(), dispose()}
  // fit (default): scale down to the box's width; fit: false keeps 100% and lets the box's parent scroll.
  function show(origBox, cloneBox, { capture, shot, doc, fit = true }) {
    const width = capture.vw;
    const top = capture.rect.y - Math.floor(capture.rect.y);
    let cloneHeight = 0;

    const orig = make('div', 'vp');
    orig.style.background = capture.bg;
    let img = null;
    if (shot) {
      img = make('img', '');
      img.src = shot;
      img.alt = 'Original';
      orig.append(img);
    } else {
      const note = make('p', 'no-shot');
      note.textContent = 'The element has no box of its own at this width (hidden or display: contents).';
      orig.append(note);
    }
    const clone = make('div', 'vp');
    const frame = make('iframe', '');
    frame.src = chrome.runtime.getURL('preview.html');
    frame.width = String(width);
    frame.title = 'Clone preview';
    frame.addEventListener('load', () => frame.contentWindow.postMessage({ type: 'render', html: doc }, '*'));
    clone.append(frame);
    origBox.replaceChildren(orig);
    cloneBox.replaceChildren(clone);

    const layout = () => {
      const height = Math.max(top + capture.rect.height, cloneHeight);
      for (const [box, vp] of [[origBox, orig], [cloneBox, clone]]) {
        box.style.minWidth = fit ? '' : `${width}px`;
        // never wider than the page itself, so a narrow page sits centred instead of beside a blank strip
        box.style.maxWidth = `${width}px`;
        const scale = fit ? Math.min(1, (box.clientWidth || width) / width) : 1;
        Object.assign(vp.style, { width: `${width}px`, height: `${height}px`, transform: `scale(${scale})` });
        box.style.height = `${Math.ceil(height * scale)}px`;
      }
      if (img) Object.assign(img.style, { left: `${capture.rect.x}px`, top: `${top}px`, width: `${capture.rect.width}px` });
    };
    // Growth guard: if the clone keeps getting taller every time the frame is resized to fit it (something in it
    // sized by vh), stop following it rather than chase it forever.
    let growths = 0;
    const onMessage = (e) => {
      if (e.source !== frame.contentWindow || !e.data || e.data.type !== 'mui-height') return;
      if (e.data.h > cloneHeight && cloneHeight && ++growths > 6) return;
      cloneHeight = e.data.h;
      frame.style.height = `${cloneHeight}px`;
      layout();
    };
    window.addEventListener('message', onMessage);
    layout();
    return { layout, dispose: () => window.removeEventListener('message', onMessage) };
  }

  return { show };
})();
