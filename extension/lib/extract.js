// Runs inside the target page (injected by the CLI via Playwright, or by the browser extension).
// Classic script, no dependencies. Defines globalThis.MirrorUIExtract:
//   freeze() / unfreeze()        stop animations and transitions so styles are read in their final state
//   extract(selector)            walk the subtree and return the capture (below)
//   hoverDiff(i)                 styles that changed under :hover, called while the runner forces :hover
//                                on the element marked data-mui-hover="i" (needs DevTools protocol)
//   hideOverlays(selector) / restoreOverlays()   keep fixed headers/cookie bars out of screenshots
//   cleanup()                    remove every mark this script left in the page
//   inlineSprites(svg), fontSources()            also used by the toolbar's Assets and Fonts tools
//
// Each element node in the capture carries:
//   s  - raw computed values for every property in PROPS
//   k  - the subset that differs from a Tailwind-preflight baseline (non-inherited props) or from the parent
//        (inherited props)
//   fw/fh - true when width/height are "free": setting them to auto doesn't move the box, so the value is
//        content-driven noise
//   i  - index in document order, used to attach hover diffs
//   pb/pa - ::before / ::after, as pseudo nodes with their own s/k
(() => {
  const PROPS = [
    'display', 'position', 'top', 'right', 'bottom', 'left', 'z-index',
    'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-self',
    'flex-grow', 'flex-shrink', 'flex-basis', 'order',
    'row-gap', 'column-gap', 'grid-template-columns', 'grid-column-start', 'grid-column-end',
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
    'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
    'text-align', 'text-transform', 'text-decoration-line', 'white-space', 'color',
    'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat',
    'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
    'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
    'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
    'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius',
    'box-shadow', 'opacity', 'overflow-x', 'overflow-y', 'object-fit', 'cursor', 'list-style-type', 'visibility',
    'box-sizing', 'resize', 'field-sizing', 'justify-items', 'fill', 'stroke',
    'text-decoration-color', 'text-decoration-thickness', 'text-decoration-style', 'text-underline-offset',
    'transform', '-webkit-line-clamp', 'text-overflow',
  ];
  const INHERITED = new Set([
    'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing',
    'text-align', 'text-transform', 'white-space', 'cursor', 'list-style-type', 'visibility', 'text-underline-offset',
  ]);
  // what hover can change without it being layout noise
  const HOVER_PROPS = PROPS.filter((p) => !['width', 'height', 'top', 'right', 'bottom', 'left'].includes(p));
  const TRANSITION = ['transition-property', 'transition-duration', 'transition-timing-function'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'LINK', 'META', 'SOURCE', 'TRACK']);
  const ATTRS = ['href', 'src', 'alt', 'title', 'type', 'name', 'placeholder', 'role', 'for', 'target', 'rel',
    'datetime', 'colspan', 'rowspan', 'poster', 'autoplay', 'muted', 'loop', 'playsinline', 'controls',
    'required', 'disabled', 'rows', 'cols', 'method'];
  const HOVER_TAGS = new Set(['a', 'button', 'label', 'summary', 'select', 'input', 'textarea']);
  const UTILITY = /^(flex|grid|block|inline|hidden|contents|relative|absolute|fixed|sticky|static|container|group|peer|isolate|truncate|italic|uppercase|lowercase|capitalize|underline|shadow|rounded|border|transition|antialiased|visible|invisible|grow|shrink|row|col|wrapper|inner|outer|content|main|clearfix|(min|max|space|gap|text|font|bg|leading|tracking|overflow|items|justify|self|place|object|order|origin|translate|scale|rotate|opacity|backdrop|blur|ring|outline|cursor|select|pointer|whitespace|break|line|list|aspect|inset|top|left|right|bottom|z|duration|ease|delay|animate|sr|not|lg|md|sm|xl|rounded|border|shadow|flex|grid|col|row|divide|fill|stroke|from|via|to|decoration|underline|transition|hover|focus|group|peer|dark|basis|content|columns|snap|scroll|touch|will|drop|filter|mix|isolation|indent|align|first|last|odd|even|before|after|placeholder)-.*)$/;
  const MAX_HOVER = 80;
  // Close to Tailwind v4 preflight: the output page will run under it, so "default" means preflight default.
  const PREFLIGHT = `
    *,::before,::after{box-sizing:border-box;margin:0;padding:0;border:0 solid}
    html{line-height:1.5;font-family:ui-sans-serif,system-ui,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji";-webkit-text-size-adjust:100%;tab-size:4}
    h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}
    a{color:inherit;text-decoration:inherit}
    b,strong{font-weight:bolder}
    ol,ul,menu{list-style:none}
    img,svg,video,canvas,audio,iframe,embed,object{display:block;vertical-align:middle}
    img,video{max-width:100%;height:auto}
    button,input,select,optgroup,textarea{font:inherit;letter-spacing:inherit;color:inherit;border-radius:0;background-color:transparent;opacity:1}
    textarea{resize:vertical}
    table{text-indent:0;border-color:inherit;border-collapse:collapse}`;
  const FREEZE_CSS = `*,*::before,*::after{animation:none!important;transition:none!important;
    scroll-behavior:auto!important;caret-color:transparent!important}`;

  // elements and their base styles from the last extract(), for hoverDiff()
  let state = { els: [], base: [] };
  const hidden = [];

  // The toolbar's Swap font loads fonts under aliases like "mui font Lora wght 400 700"; name the real family.
  // (Same isolated world as the toolbar, so its alias map is visible here; the CLI has none.)
  const realFamilies = (v) => v.replace(/"mui (?:font|preview) [^"]*"/g, (m) => {
    const name = globalThis.MUI?.fontAliases?.[m.slice(1, -1)];
    return name ? `"${name}"` : m;
  });
  const snapshot = (cs, props = PROPS) => {
    const out = Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
    if (out['font-family'] && out['font-family'].includes('"mui ')) out['font-family'] = realFamilies(out['font-family']);
    return out;
  };

  const freeze = () => {
    if (document.getElementById('mirrorui-freeze')) return;
    const st = document.createElement('style');
    st.id = 'mirrorui-freeze';
    st.textContent = FREEZE_CSS;
    document.documentElement.appendChild(st);
  };
  const unfreeze = () => document.getElementById('mirrorui-freeze')?.remove();

  // Same order and same skips as walk(), so indexes line up.
  const elementsInOrder = (root) => {
    const out = [];
    const visit = (el) => {
      out.push(el);
      if (el.tagName.toLowerCase() === 'svg') return;
      for (const c of el.children) if (!SKIP.has(c.tagName)) visit(c);
    };
    visit(root);
    return out;
  };

  // Transitions are read with the freeze lifted (it forces them to none), before anything is measured.
  const readTransitions = (els) => {
    const st = document.getElementById('mirrorui-freeze');
    if (st) st.disabled = true;
    const out = els.map((el) => snapshot(getComputedStyle(el), TRANSITION));
    if (st) st.disabled = false;
    getComputedStyle(document.documentElement).color; // flush the style change
    return out;
  };

  // <use href="#icon"> points at a sprite elsewhere in the page; copy the symbol in so the SVG stands alone
  const inlineSprites = (svg) => {
    const copy = svg.cloneNode(true);
    for (const use of copy.querySelectorAll('use')) {
      const ref = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
      const target = ref.startsWith('#') && document.getElementById(ref.slice(1));
      if (!target) continue;
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.innerHTML = target.tagName.toLowerCase() === 'symbol' ? target.innerHTML : target.outerHTML;
      if (target.getAttribute('viewBox') && !copy.getAttribute('viewBox')) {
        copy.setAttribute('viewBox', target.getAttribute('viewBox'));
      }
      use.replaceWith(g);
    }
    copy.removeAttribute('data-mui-hover');
    return copy;
  };

  // [[name, value], ...]: a list rather than an object, because chrome.storage sorts object keys
  const attrsOf = (el) => {
    const a = {};
    for (const name of ATTRS) if (el.hasAttribute(name)) a[name] = el.getAttribute(name);
    for (const { name, value } of el.attributes) if (name.startsWith('aria-')) a[name] = value;
    if (a.href !== undefined && el.href && !a.href.startsWith('#')) a.href = el.href;
    if (el.currentSrc || (a.src !== undefined && el.src)) a.src = el.currentSrc || el.src;
    return Object.entries(a);
  };

  // Selectors of the elements that :hover rules apply to: '.card:hover h3' -> '.card'. Read from the sheets
  // the page can access; cross-origin sheets fall back to the tag/cursor heuristic in walk().
  const hoverSubjects = () => {
    const out = new Set();
    const visit = (rules) => {
      for (const rule of rules) {
        if (rule.selectorText) {
          for (const part of rule.selectorText.split(/,(?![^(]*\))/)) {
            const at = part.indexOf(':hover');
            if (at <= 0 || part.slice(0, at).split('(').length !== part.slice(0, at).split(')').length) continue;
            out.add(part.slice(0, at).trim());
          }
        }
        if (rule.cssRules) visit(rule.cssRules);
      }
    };
    for (const sheet of document.styleSheets) {
      try { visit(sheet.cssRules); } catch { /* cross-origin */ }
    }
    return [...out].filter((sel) => { try { document.querySelector(sel); return true; } catch { return false; } });
  };

  // @font-face rules the page can read directly, plus URLs of cross-origin sheets the runner has to fetch.
  const fontSources = () => {
    const faces = [], sheets = [];
    const absolutize = (css, base) => css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g,
      (m, q, u) => (u.startsWith('data:') ? m : `url("${new URL(u, base).href}")`));
    const visit = (sheet) => {
      let rules;
      try { rules = sheet.cssRules; } catch { if (sheet.href) sheets.push(sheet.href); return; }
      const base = sheet.href || location.href;
      for (const rule of rules) {
        if (rule instanceof CSSFontFaceRule) faces.push(absolutize(rule.cssText, base));
        else if (rule instanceof CSSImportRule && rule.styleSheet) visit(rule.styleSheet);
        else if (rule.cssRules) visit({ cssRules: rule.cssRules, href: sheet.href });
      }
    };
    for (const sheet of document.styleSheets) visit(sheet);
    return { faces, sheets: [...new Set(sheets)] };
  };

  const extract = (selector) => {
    const root = document.querySelector(selector);
    if (!root) return { error: `selector not found: ${selector}` };

    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1200px;height:800px;border:0;visibility:hidden';
    document.documentElement.appendChild(frame);
    const bdoc = frame.contentDocument;
    const bstyle = bdoc.createElement('style');
    bstyle.textContent = PREFLIGHT;
    bdoc.head.appendChild(bstyle);
    const bodyBase = snapshot(frame.contentWindow.getComputedStyle(bdoc.body));
    const baseCache = {};
    const baseline = (tag) => {
      if (!baseCache[tag]) {
        const el = tag === 'svg' ? bdoc.createElementNS('http://www.w3.org/2000/svg', 'svg') : bdoc.createElement(tag);
        bdoc.body.appendChild(el);
        baseCache[tag] = snapshot(frame.contentWindow.getComputedStyle(el));
        el.remove();
      }
      return baseCache[tag];
    };

    // Does forcing `prop: value` leave the box where it is? Then the computed px value is just the result of
    // layout. The element, its parent and next sibling are measured: a bottom/right margin only moves those.
    const boxes = (el) => [el, el.parentElement, el.nextElementSibling]
      .map((e) => (e ? e.getBoundingClientRect() : null));
    // sameWith(el, 'width', before) or sameWith(el, {width: 'auto', height: 'auto'}, before) to test several at once
    const sameWith = (el, prop, before, value = 'auto') => {
      const st = el.style;
      const changes = typeof prop === 'string' ? { [prop]: value } : prop;
      const saved = Object.keys(changes).map((p) => [p, st.getPropertyValue(p), st.getPropertyPriority(p)]);
      for (const [p, v] of Object.entries(changes)) st.setProperty(p, v, 'important');
      const after = boxes(el);
      for (const [p, old, pri] of saved) if (old) st.setProperty(p, old, pri); else st.removeProperty(p);
      return after.every((r, i) => !r || ['x', 'y', 'width', 'height'].every((k) => Math.abs(r[k] - before[i][k]) < 0.5));
    };
    // images, SVGs, video… keep their aspect ratio: with only one side set to auto it's recomputed from the other
    // and nothing moves, though both together fall back to the natural size. So they are tested as a pair.
    const REPLACED = new Set(['img', 'svg', 'video', 'canvas', 'iframe', 'object', 'embed', 'picture']);
    const SIDES = { t: 'margin-top', r: 'margin-right', b: 'margin-bottom', l: 'margin-left' };
    const INSETS = ['top', 'right', 'bottom', 'left'];

    const order = elementsInOrder(root);
    const transitions = readTransitions(order);
    state = { els: order, base: [] };
    let index = 0;
    let hoverCount = 0;
    const subjects = hoverSubjects();

    const pseudo = (el, which, hostStyles, hostDisplay) => {
      const cs = getComputedStyle(el, which);
      const content = cs.getPropertyValue('content');
      if (['none', 'normal'].includes(content) || cs.display === 'none') return null;
      const s = snapshot(cs);
      const base = baseline('span');
      const k = PROPS.filter((p) => s[p] !== (INHERITED.has(p) ? hostStyles[p] : base[p]));
      // Pseudo boxes can't be probed with inline styles; text content sizes itself, empty boxes are drawn shapes.
      const sized = content === '""' || content.startsWith('url(');
      return {
        t: which, s, k, content, pd: hostDisplay,
        w: parseFloat(s.width) || 0, h: parseFloat(s.height) || 0,
        fw: !sized || s.display === 'inline', fh: !sized || s.display === 'inline',
      };
    };

    // parentDisplay is the display of the nearest ancestor that generates a box (skips display:contents)
    const walk = (el, parentStyles, parentDisplay) => {
      const i = index++;
      const tag = el.tagName.toLowerCase();
      const cs = getComputedStyle(el);
      const s = snapshot(cs);
      state.base[i] = s;
      const base = baseline(tag);
      const k = PROPS.filter((p) => s[p] !== (INHERITED.has(p) ? (parentStyles || bodyBase)[p] : base[p]));
      // min-width/min-height default to auto for flex and grid items, not 0 as in the (block) baseline: the
      // ubiquitous min-w-0 that stops a flex child from growing with its content would otherwise be dropped
      const contextDefault = /flex|grid/.test(parentDisplay) ? 'auto' : '0px';
      for (const p of ['min-width', 'min-height']) {
        const has = k.includes(p);
        if (s[p] !== contextDefault && !has) k.push(p);
        else if (s[p] === contextDefault && has) k.splice(k.indexOf(p), 1);
      }
      const r = el.getBoundingClientRect();
      const n = {
        t: tag, i, a: attrsOf(el), s, k,
        w: r.width, h: r.height,
        cw: el.clientWidth - parseFloat(s['padding-left']) - parseFloat(s['padding-right']),
        ch: el.clientHeight - parseFloat(s['padding-top']) - parseFloat(s['padding-bottom']),
        fw: true, fh: true, c: [], pd: parentDisplay,
        // naming hint for components and loops; utility classes like col-md-6, mb-4 or flex make bad names
        cn: [...el.classList].find((c) => c.length > 2 && !/[\d:[\]/!]/.test(c) && !/^[a-z]{1,3}-/.test(c) && !UTILITY.test(c)) || '',
        x: r.x,
      };
      if (parseFloat(transitions[i]['transition-duration']) > 0) n.tr = transitions[i];
      // a transform written into the inline style is almost always JS animation caught mid-flight: not design
      if (el.style.transform || el.style.translate) n.jt = true;
      if (!['inline', 'none', 'contents'].includes(s.display)) {
        const before = boxes(el);
        if (REPLACED.has(tag)) {
          n.fw = n.fh = sameWith(el, { width: 'auto', height: 'auto' }, before);
        } else {
          n.fw = sameWith(el, 'width', before);
          n.fh = sameWith(el, 'height', before);
        }
        // margin:auto shows up as px in computed style. It was auto if setting auto changes nothing while
        // both 0 and a larger margin do: an auto margin holds exactly the free space, whereas a margin
        // followed by slack (last child of a stretched box) survives all three unchanged.
        // Only axes where auto margins are actually written: left/right in block flow (mx-auto), the main axis
        // in flex. On a flex cross axis an auto margin and an equal fixed one in every item are indistinguishable.
        const pdir = parentStyles ? parentStyles['flex-direction'] : 'row';
        const axes = !/flex/.test(parentDisplay) ? 'lr' : pdir.startsWith('column') ? 'tb' : 'lr';
        n.ma = Object.entries(SIDES)
          .filter(([key, p]) => (/grid/.test(parentDisplay) || axes.includes(key))
            && parseFloat(s[p]) > 0.5 && sameWith(el, p, before)
            && !sameWith(el, p, before, '0px')
            && !sameWith(el, p, before, `${parseFloat(s[p]) + 16}px`))
          .map(([key]) => key).join('');
        // positioned elements report auto insets as px too
        if (s.position !== 'static') n.ia = INSETS.filter((p) => sameWith(el, p, before));
      }
      if (tag === 'input' || tag === 'textarea') {
        n.ph = getComputedStyle(el, '::placeholder').getPropertyValue('color');
      }
      const pointerStart = s.cursor === 'pointer' && (!parentStyles || parentStyles.cursor !== 'pointer');
      const hoverable = subjects.some((sel) => el.matches(sel))
        || HOVER_TAGS.has(tag) || el.getAttribute('role') === 'button' || pointerStart;
      if (hoverable && hoverCount < MAX_HOVER) {
        el.setAttribute('data-mui-hover', i);
        n.hv = true;
        hoverCount++;
      }
      if (tag === 'svg') {
        n.svg = inlineSprites(el).outerHTML;
        return n;
      }
      const pb = pseudo(el, '::before', s, s.display);
      const pa = pseudo(el, '::after', s, s.display);
      if (pb) n.pb = pb;
      if (pa) n.pa = pa;
      const childDisplay = s.display === 'contents' ? parentDisplay : s.display;
      const pre = s['white-space'].startsWith('pre') || s['white-space'] === 'break-spaces';
      for (const child of el.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = pre ? child.textContent : child.textContent.replace(/\s+/g, ' ');
          if (text.trim()) n.c.push({ text });
          else if (text && n.c.length) n.c.push({ text: ' ' });
        } else if (child.nodeType === Node.ELEMENT_NODE && !SKIP.has(child.tagName)) {
          n.c.push(walk(child, s, childDisplay));
        }
      }
      return n;
    };

    try {
      const rootParent = root.parentElement ? getComputedStyle(root.parentElement).display : 'block';
      // the color the component sits on, so the clone can be shown (and compared) on the same backdrop
      let bg = 'rgb(255, 255, 255)';
      for (let a = root.parentElement; a; a = a.parentElement) {
        const c = getComputedStyle(a).backgroundColor;
        if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') { bg = c; break; }
      }
      const tree = walk(root, null, rootParent);
      // A grid/flex item stretched by its row loses that height once it stands alone; remember it so the
      // component keeps its shape (justify-between columns and the like).
      if (/flex|grid/.test(rootParent) && tree.fh) {
        const st = root.style, old = st.getPropertyValue('align-self'), pri = st.getPropertyPriority('align-self');
        st.setProperty('align-self', 'start', 'important');
        const natural = root.getBoundingClientRect().height;
        if (old) st.setProperty('align-self', old, pri); else st.removeProperty('align-self');
        if (tree.h - natural > 0.5) tree.sh = tree.h;
      }
      const r = root.getBoundingClientRect();
      return {
        // vcw/vch: the layout viewport fixed elements are placed in (innerWidth minus any scrollbar gutter)
        root: tree, bg, vw: innerWidth, vh: innerHeight, lang: document.documentElement.lang || 'en',
        vcw: document.documentElement.clientWidth, vch: document.documentElement.clientHeight,
        title: document.title, url: location.href, fonts: fontSources(),
        rect: { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height },
      };
    } finally {
      frame.remove();
    }
  };

  // Called while :hover is forced on element i. Returns {j: {prop: value}} for i and its descendants.
  const hoverDiff = (i) => {
    const el = state.els[i];
    if (!el) return {};
    const out = {};
    state.els.forEach((e, j) => {
      if (e !== el && !el.contains(e)) return;
      const now = snapshot(getComputedStyle(e), HOVER_PROPS);
      const changed = HOVER_PROPS.filter((p) => now[p] !== state.base[j][p]);
      if (changed.length) out[j] = Object.fromEntries(changed.map((p) => [p, now[p]]));
    });
    return out;
  };

  const hideOverlays = (selector) => {
    const target = document.querySelector(selector);
    // `body ~ *`: overlays attached after <body>, like the MirrorUI toolbar itself
    for (const e of document.querySelectorAll('body *, body ~ *')) {
      const p = getComputedStyle(e).position;
      if ((p === 'fixed' || p === 'sticky') && target && !e.contains(target) && !target.contains(e)) {
        hidden.push([e, e.style.getPropertyValue('visibility'), e.style.getPropertyPriority('visibility')]);
        e.style.setProperty('visibility', 'hidden', 'important');
      }
    }
  };
  const restoreOverlays = () => {
    for (const [e, v, pri] of hidden.splice(0)) {
      if (v) e.style.setProperty('visibility', v, pri); else e.style.removeProperty('visibility');
    }
  };

  const cleanup = () => {
    for (const e of document.querySelectorAll('[data-mui-hover]')) e.removeAttribute('data-mui-hover');
    restoreOverlays();
    unfreeze();
    state = { els: [], base: [] };
  };

  globalThis.MirrorUIExtract = {
    freeze, unfreeze, extract, hoverDiff, hideOverlays, restoreOverlays, cleanup, inlineSprites, fontSources,
  };
})();
