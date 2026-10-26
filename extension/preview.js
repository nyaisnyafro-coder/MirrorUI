// Sandboxed page (see manifest "sandbox"): receives the generated document from the results page, renders
// it in place, and reports its height back so the results page can size the frame.
window.addEventListener('message', (e) => {
  if (!e.data || e.data.type !== 'render') return;
  const reporter = '<script>(function () {'
    + 'function r() { var f = document.getElementById("mirrorui-frame");'
    + ' parent.postMessage({ type: "mui-height", h: Math.ceil(f ? f.getBoundingClientRect().height : document.body.scrollHeight) }, "*"); }'
    + 'addEventListener("load", function () { r(); setTimeout(r, 300); setTimeout(r, 1000); });'
    + 'new ResizeObserver(r).observe(document.documentElement);'
    + '})();<\/script>';
  // Chrome gives extension pages `body { font-family: "Segoe UI"…; font-size: 75% }`; a normal page doesn't
  // have that, so undo it before the clone's own styles load.
  // the frame is sized to the content, so it never needs its own scrollbar
  // A hair below full opacity makes Chrome draw the text with greyscale antialiasing: the preview is shown
  // scaled down, and shrunk subpixel text shows coloured fringes. (Not visible: 0.999 rounds to the same colours.)
  const reset = '<style>body { font-family: inherit; font-size: 100%; } html { overflow: hidden; opacity: 0.999; }</style>';
  document.open();
  document.write(e.data.html.replace('<head>', `<head>\n${reset}`).replace('</body>', `${reporter}</body>`));
  document.close();
});
