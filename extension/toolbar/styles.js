// Styles for the in-page UI. They live inside the toolbar's shadow root, so the site's CSS can't reach them
// and they can't leak into the site.
globalThis.MirrorUIStyles = `
:host { all: initial; }
* { box-sizing: border-box; }
.mui { font: 13px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #ece9f4;
  -webkit-font-smoothing: antialiased; }
button { font: inherit; color: inherit; }
svg.i { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round;
  stroke-linejoin: round; flex: none; }

/* toolbar */
.bar { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); display: flex; align-items: stretch; gap: 2px;
  padding: 6px; background: rgba(16, 13, 24, .96); border: 1px solid #2e2840; border-radius: 16px; pointer-events: auto;
  box-shadow: 0 12px 40px rgba(0, 0, 0, .35), 0 0 0 1px rgba(124, 92, 255, .18); max-width: calc(100vw - 24px); }
.brand { display: grid; place-items: center; width: 34px; margin: 0 4px 0 2px; }
.brand svg { width: 22px; height: 22px; }
.tool { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; min-width: 64px;
  padding: 8px 8px 6px; border: 0; border-radius: 11px; background: transparent; color: #cfc9de; cursor: pointer;
  font-size: 11px; font-weight: 600; line-height: 1; white-space: nowrap; }
.tool:hover { background: #221d2e; color: #fff; }
.tool[aria-pressed="true"] { background: #7c5cff; color: #fff; }
.tool.square { min-width: 38px; padding: 8px; }
.sep { width: 1px; background: #2e2840; margin: 6px 4px; }
.mini { position: fixed; right: 16px; bottom: 16px; width: 44px; height: 44px; border-radius: 14px; border: 1px solid #2e2840;
  background: rgba(16, 13, 24, .96); display: grid; place-items: center; cursor: pointer; pointer-events: auto;
  box-shadow: 0 8px 28px rgba(0, 0, 0, .35); }
.mini svg { width: 24px; height: 24px; }

/* side panel */
.panel { position: fixed; top: 16px; right: 16px; bottom: 92px; width: 460px; max-width: calc(100vw - 32px);
  display: flex; flex-direction: column; background: #0e0c14; border: 1px solid #2e2840; border-radius: 14px;
  pointer-events: auto; overflow: hidden; box-shadow: 0 16px 48px rgba(0, 0, 0, .4); }
.panel > header { display: flex; align-items: flex-start; gap: 10px; padding: 14px 14px 12px; border-bottom: 1px solid #221d2e;
  cursor: move; user-select: none; }
/* dragged somewhere: anchored by its top-left corner instead of the right edge */
.panel.moved { right: auto; bottom: auto; height: min(calc(100vh - 108px), 820px); }
.panel.compact { bottom: auto; height: auto !important; }
.panel.compact .body { display: none; }

/* result window (Pick, Clone page) */
.modal { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); width: min(1500px, calc(100vw - 32px));
  height: calc(100vh - 108px); display: flex; flex-direction: column; background: #0e0c14; border: 1px solid #2e2840;
  border-radius: 14px; pointer-events: auto; overflow: hidden; box-shadow: 0 24px 64px rgba(0, 0, 0, .5); }
.modal.moved { transform: none; }
.modal > header { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-bottom: 1px solid #221d2e;
  cursor: move; user-select: none; }
.modal > header .titles { min-width: 0; flex: 0 1 auto; }
.modal > header h2 { margin: 0; font-size: 15px; font-weight: 700; }
.modal > header p { margin: 2px 0 0; color: #9a93ad; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.modal .controls { display: flex; align-items: center; gap: 6px; margin-left: auto; flex-wrap: wrap; justify-content: flex-end; }
.modal .mbody { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.modal .code-pane { display: flex; flex-direction: column; min-height: 0; border-bottom: 1px solid #221d2e; padding: 10px 14px; }
.modal .code-pane pre { flex: 1; max-height: none; min-height: 0; }
.modal .splitter { height: 6px; cursor: row-resize; background: #15121d; border-bottom: 1px solid #221d2e; flex: none; }
.modal .splitter:hover { background: #2b2350; }
.modal .preview-pane { flex: 1; min-height: 0; display: flex; flex-direction: column; padding: 10px 14px 14px; }
.modal .preview-scroll { flex: 1; min-height: 0; overflow: auto; border-radius: 8px; background: #15121d; }
.modal .preview-grid { display: grid; gap: 12px; }
.modal .preview-grid.two { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.modal .preview-grid .stage { margin: 0 auto; width: 100%; }
.modal .bar-row2 { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
.modal .label { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #9a93ad; }
@media (max-width: 820px) {
  .modal { top: 8px; width: calc(100vw - 16px); height: calc(100vh - 80px); }
  .modal .preview-grid.two { grid-template-columns: minmax(0, 1fr); }
}
.panel > header .titles { flex: 1; min-width: 0; }
.panel > header h2 { margin: 0; font-size: 15px; font-weight: 700; }
.panel > header p { margin: 2px 0 0; color: #9a93ad; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.panel .actions { display: flex; gap: 6px; flex-wrap: wrap; padding: 10px 14px; border-bottom: 1px solid #221d2e; }
.panel .body { flex: 1; overflow: auto; padding: 12px 14px 16px; }
.panel .body::-webkit-scrollbar, pre::-webkit-scrollbar { width: 8px; height: 8px; }
.panel .body::-webkit-scrollbar-thumb, pre::-webkit-scrollbar-thumb { background: #2e2840; border-radius: 4px; }

.btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 8px; border: 1px solid #2e2840;
  background: #1a1624; color: #ece9f4; font-size: 12px; font-weight: 600; cursor: pointer; line-height: 1.2; white-space: nowrap; }
.btn svg.i { width: 14px; height: 14px; }
.btn:hover { border-color: #7c5cff; }
.btn.primary { background: #7c5cff; border-color: #7c5cff; color: #fff; }
.btn[aria-pressed="true"] { background: #2b2350; border-color: #7c5cff; color: #fff; }
.btn:disabled { opacity: .5; cursor: default; }
.btn.ghost { background: transparent; border-color: transparent; color: #9a93ad; padding: 6px; }
.btn.ghost:hover { color: #fff; border-color: transparent; background: #1a1624; }
.seg { display: flex; gap: 4px; flex-wrap: wrap; }
.row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.spacer { flex: 1; }
.muted { color: #9a93ad; }
.small { font-size: 12px; }
.section { margin: 14px 0 6px; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #9a93ad; }
.section:first-child { margin-top: 0; }
.empty { color: #9a93ad; text-align: center; padding: 30px 10px; }
.error { background: #3a1820; border: 1px solid #6b2a36; color: #ff9a9a; padding: 10px 12px; border-radius: 8px; }
input[type="text"], input[type="search"] { width: 100%; background: #15121d; border: 1px solid #2e2840; color: #ece9f4;
  border-radius: 8px; padding: 7px 9px; font: inherit; outline: none; }
input[type="text"]:focus, input[type="search"]:focus { border-color: #7c5cff; }
label.check { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #cfc9de; cursor: pointer; }
pre { margin: 0; background: #15121d; border: 1px solid #221d2e; border-radius: 8px; padding: 10px 12px; max-height: 340px;
  overflow: auto; font: 11.5px/1.55 ui-monospace, "Cascadia Code", Consolas, monospace; white-space: pre; color: #dcd6ea; }
kbd { background: #221d2e; border: 1px solid #2e2840; border-radius: 4px; padding: 0 4px; font: 11px ui-monospace, monospace; }

/* hover highlight, tooltip, hint, toast */
.box { position: fixed; pointer-events: none; border: 2px solid #7c5cff; background: rgba(124, 92, 255, .10); border-radius: 2px; }
.box.selected { border-color: #7c5cff; background: rgba(124, 92, 255, .16); }
.box.other { border: 1px dashed #2bd4a4; background: rgba(43, 212, 164, .08); }
.box.pad { border: 0; background: rgba(43, 212, 164, .18); }
.tip { position: fixed; pointer-events: none; background: #120f1a; color: #ece9f4; border: 1px solid #2e2840; border-radius: 8px;
  padding: 7px 9px; font-size: 12px; line-height: 1.5; max-width: 340px; box-shadow: 0 8px 24px rgba(0, 0, 0, .35); }
.tip b { color: #fff; } .tip .dim { color: #9a93ad; } .tip .acc { color: #b8a6ff; }
.sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; border: 1px solid rgba(255, 255, 255, .3);
  vertical-align: -1px; margin-right: 4px; }
.box.guide { border: 0; background: #ff5c8a; border-radius: 0; }
.guide-label { position: fixed; pointer-events: none; background: #ff5c8a; color: #fff; font: 600 11px/1 system-ui;
  padding: 3px 5px; border-radius: 4px; transform: translate(-50%, -50%); }
.hint { position: fixed; left: 50%; bottom: 92px; transform: translateX(-50%); background: #120f1a; border: 1px solid #2e2840;
  color: #ece9f4; padding: 7px 12px; border-radius: 9px; font-size: 12px; white-space: nowrap; pointer-events: none;
  box-shadow: 0 8px 24px rgba(0, 0, 0, .3); }
.toast { position: fixed; left: 50%; top: 18px; transform: translateX(-50%); background: #7c5cff; color: #fff; padding: 8px 14px;
  border-radius: 10px; font-size: 12.5px; font-weight: 600; pointer-events: none; box-shadow: 0 8px 24px rgba(0, 0, 0, .3); }
[hidden] { display: none !important; }

/* pick result */
.stage { position: relative; overflow: hidden; border: 1px solid #221d2e; border-radius: 8px; background: #fff; margin-top: 6px; }
.vp { position: relative; transform-origin: 0 0; }
.vp img { position: absolute; display: block; }
.vp iframe { border: 0; display: block; background: transparent; }
.no-shot { position: absolute; inset: 0; margin: 0; display: grid; place-items: center; padding: 40px; text-align: center;
  color: #555; font-size: 40px; }
.cap { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; font-size: 12px; color: #9a93ad; }
.progress { display: flex; flex-direction: column; gap: 8px; padding: 20px 4px; }
.progress .step { display: flex; align-items: center; gap: 8px; color: #9a93ad; }
.progress .step.done { color: #ece9f4; }
.progress .step.now { color: #b8a6ff; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex: none; }

/* inspector */
.props { display: grid; grid-template-columns: 120px 1fr; gap: 4px 10px; font: 12px/1.5 ui-monospace, Consolas, monospace; }
.props dt { color: #9a93ad; margin: 0; } .props dd { margin: 0; color: #ece9f4; word-break: break-all; }
.boxmodel { margin: 6px 0 4px; font: 11px/1 ui-monospace, Consolas, monospace; text-align: center; color: #cfc9de; }
.boxmodel div { border: 1px dashed #4a4166; padding: 6px 10px; border-radius: 4px; position: relative; }
.boxmodel .m { background: rgba(255, 170, 80, .08); } .boxmodel .p { background: rgba(43, 212, 164, .10); margin-top: 4px; }
.boxmodel .c { background: rgba(124, 92, 255, .18); margin-top: 4px; padding: 8px; }
.boxmodel .t { display: flex; justify-content: space-between; color: #9a93ad; margin-bottom: 4px; }

/* colors */
.color { display: flex; align-items: center; gap: 10px; padding: 14px 12px; border-radius: 10px; margin-bottom: 8px; cursor: pointer;
  border: 1px solid rgba(255, 255, 255, .08); font: 600 12px/1 ui-monospace, Consolas, monospace; }
.color .cnt { margin-left: auto; font-weight: 400; opacity: .8; }
.color button { background: rgba(0, 0, 0, .15); border: 0; border-radius: 6px; padding: 4px; cursor: pointer; color: inherit; display: grid; }
.color button svg.i { width: 14px; height: 14px; }

/* fonts */
.font { border: 1px solid #221d2e; border-radius: 10px; padding: 12px; margin-bottom: 10px; background: #12101a; }
.font .name { display: flex; align-items: center; gap: 8px; font-weight: 700; }
.font .sample { font-size: 24px; line-height: 1.2; margin: 10px 0; color: #fff; overflow-wrap: anywhere; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip { background: #221d2e; border-radius: 5px; padding: 2px 6px; font: 11px/1.5 ui-monospace, Consolas, monospace; color: #cfc9de; }
.badge { font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 5px; background: #1e3a2c; color: #7be0b0; }
.badge.warn { background: #3a2e18; color: #f0c674; }

/* swap font */
.font-pick { display: block; width: 100%; text-align: left; cursor: pointer; font: inherit; color: inherit; }
.font-pick:hover { border-color: #7c5cff; }
.font-pick.current { border-color: #7c5cff; background: #1d1830; }
.font-pick .sample { font-size: 22px; margin: 8px 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* arrange */
.box.drag-source { border: 2px dashed #9a93ad; background: rgba(154, 147, 173, .12); }
.box.drop-line { border: 0; background: #2bd4a4; border-radius: 2px; box-shadow: 0 0 0 2px rgba(43, 212, 164, .35); }
.box.drop-into { border: 2px solid #2bd4a4; background: rgba(43, 212, 164, .08); }
.box.delete { border-color: #ff5c8a; background: rgba(255, 92, 138, .12); }

/* design md */
pre.tall { max-height: none; }
.swatches { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.swatch { border: 1px solid #221d2e; border-radius: 8px; overflow: hidden; background: #12101a; }
.swatch > div:last-child { padding: 6px 8px; overflow: hidden; }
.swatch b { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chip-color { height: 44px; border-bottom: 1px solid #221d2e; }
.spec { border-bottom: 1px solid #1c1826; padding: 8px 0; }
.spec-text { color: #fff; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bar-row { display: grid; grid-template-columns: 54px auto 1fr; align-items: center; gap: 8px; margin: 3px 0; }
.bar-row .space-bar { height: 10px; background: #7c5cff; border-radius: 2px; min-width: 1px; }
.tiles { display: flex; flex-wrap: wrap; gap: 10px; }
.tile { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px; overflow: hidden; border-radius: 8px; }
.rbox { width: 56px; height: 56px; background: #2b2350; border: 1px solid #7c5cff; }
.sbox { width: 72px; height: 52px; background: #fff; border-radius: 6px; margin: 6px; }
.btn-sample { display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* responsive and capture */
.devices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.device { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 10px; border-radius: 10px;
  border: 1px solid #2e2840; background: #15121d; cursor: pointer; text-align: left; }
.device:hover { border-color: #7c5cff; }
.device[aria-pressed="true"] { border-color: #7c5cff; background: #2b2350; }
.device b { font-size: 13px; } .device span { font-size: 11.5px; color: #9a93ad; }
.shots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.shot { border: 1px solid #221d2e; border-radius: 10px; overflow: hidden; background: #12101a; }
.shot img { display: block; width: 100%; max-height: 260px; object-fit: cover; object-position: top; background: #fff; }
.shot .meta { display: flex; align-items: center; gap: 4px; padding: 6px 8px; font-size: 11.5px; color: #9a93ad; }
.shot .meta span { flex: 1; }
.result img { display: block; max-width: 100%; border: 1px solid #221d2e; border-radius: 8px; background: #fff; }
.region { position: fixed; inset: 0; cursor: crosshair; pointer-events: auto; background: rgba(10, 8, 16, .25); }
.region .sel { position: fixed; border: 2px solid #7c5cff; background: rgba(124, 92, 255, .12); }
.region .dim-label { position: fixed; background: #7c5cff; color: #fff; font: 600 11px/1 system-ui; padding: 3px 5px; border-radius: 4px; }

/* edit text */
.edit-row { border: 1px solid #221d2e; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px; background: #12101a; }
.edit-row .before { color: #ff9a9a; text-decoration: line-through; overflow-wrap: anywhere; }
.edit-row .after { color: #7be0b0; overflow-wrap: anywhere; }
.box.edited { border: 1px dashed #2bd4a4; background: rgba(43, 212, 164, .06); }
.box.editing { border: 2px solid #2bd4a4; background: transparent; }

/* below the labelled toolbar's ~900px: icons only (the title attribute still names each tool) */
@media (max-width: 1040px) {
  .tool { min-width: 44px; font-size: 0; gap: 0; padding: 8px; }
}
/* narrow viewports (phones, or the Responsive tool emulating one) */
@media (max-width: 820px) {
  .bar { left: 8px; right: 8px; transform: none; overflow-x: auto; bottom: 8px; }
  .brand { display: none; }
  .panel { top: auto; left: 8px; right: 8px; bottom: 72px; width: auto; max-width: none; height: 62vh; }
  .panel.compact { top: auto; bottom: 72px; }
  .hint { bottom: 72px; max-width: calc(100vw - 16px); white-space: normal; text-align: center; }
}

/* assets */
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.asset { border: 1px solid #221d2e; border-radius: 10px; overflow: hidden; background: #12101a; display: flex; flex-direction: column; }
.asset .thumb { height: 120px; display: grid; place-items: center; overflow: hidden; position: relative;
  background: repeating-conic-gradient(#1c1826 0% 25%, #15121d 0% 50%) 0 0 / 16px 16px; }
.asset .thumb img, .asset .thumb video { max-width: 100%; max-height: 100%; object-fit: contain; }
.asset .thumb svg { max-width: 80%; max-height: 80%; }
.asset .thumb input { position: absolute; top: 8px; left: 8px; }
.asset .meta { display: flex; align-items: center; gap: 4px; padding: 8px; font-size: 11.5px; color: #9a93ad; }
.asset .meta span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
`;
