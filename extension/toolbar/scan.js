// Page scans shared by Colors, Fonts and Design MD: what the page renders, measured from computed styles
// of visible elements (not read from its source CSS).
(() => {
  const unquote = (s) => s.trim().replace(/^["']+|["']+$/g, '');

  // [{hex, count, roles: Set(text|background|border|svg), els}] most used first
  MUI.scanColors = () => {
    const map = new Map();
    const add = (value, role, el) => {
      const hex = MUI.hex(value);
      if (!hex || (hex.length === 9 && hex.endsWith('00'))) return; // fully transparent
      let c = map.get(hex);
      if (!c) map.set(hex, (c = { hex, count: 0, roles: new Set(), els: [] }));
      c.count++;
      c.roles.add(role);
      if (c.els.length < 200 && !c.els.includes(el)) c.els.push(el);
    };
    for (const el of MUI.visibleElements()) {
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden') continue;
      if (MUI.hasOwnText(el)) add(cs.color, 'text', el);
      add(cs.backgroundColor, 'background', el);
      for (const s of ['top', 'right', 'bottom', 'left']) {
        if (parseFloat(cs.getPropertyValue(`border-${s}-width`)) > 0 && cs.getPropertyValue(`border-${s}-style`) !== 'none') {
          add(cs.getPropertyValue(`border-${s}-color`), 'border', el);
        }
      }
      if (el instanceof SVGElement) {
        if (cs.fill.startsWith('rgb')) add(cs.fill, 'svg', el);
        if (cs.stroke.startsWith('rgb') && cs.strokeWidth !== '0px') add(cs.stroke, 'svg', el);
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  };

  // [{name, key, stack, count, weights: Map, sizes: Map, styles: Set, els, web: 'loaded'|status|null}]
  MUI.scanFonts = () => {
    const map = new Map();
    for (const el of MUI.visibleElements()) {
      if (!MUI.hasOwnText(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden') continue;
      const name = unquote(cs.fontFamily.split(',')[0]);
      const key = name.toLowerCase();
      let f = map.get(key);
      if (!f) map.set(key, (f = { name, key, stack: cs.fontFamily, count: 0, weights: new Map(), sizes: new Map(), styles: new Set(), els: [] }));
      if (cs.fontFamily.length > f.stack.length) f.stack = cs.fontFamily;
      f.count++;
      f.weights.set(cs.fontWeight, (f.weights.get(cs.fontWeight) || 0) + 1);
      const size = `${Math.round(parseFloat(cs.fontSize) * 100) / 100}px`;
      f.sizes.set(size, (f.sizes.get(size) || 0) + 1);
      f.styles.add(cs.fontStyle);
      if (f.els.length < 200) f.els.push(el);
    }
    // which families come from @font-face (web fonts) and whether they finished loading
    const web = new Map();
    for (const face of document.fonts) {
      const key = unquote(face.family).toLowerCase();
      web.set(key, web.get(key) === 'loaded' ? 'loaded' : face.status);
    }
    const out = [...map.values()].sort((a, b) => b.count - a.count);
    for (const f of out) f.web = web.get(f.key) || null;
    return out;
  };

  // Stylesheet texts, readable ones from the CSSOM and cross-origin ones fetched by the service worker.
  // [{url, rules: CSSRuleList} | {url, text}]
  MUI.styleSheets = async () => {
    const out = [];
    for (const sheet of document.styleSheets) {
      try { out.push({ url: sheet.href || location.href, rules: sheet.cssRules }); } catch {
        if (!sheet.href) continue;
        const res = await MUI.send({ type: 'fetch-text', url: sheet.href });
        if (res && res.text) out.push({ url: sheet.href, text: res.text });
      }
    }
    return out;
  };
})();
