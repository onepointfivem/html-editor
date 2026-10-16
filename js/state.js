/* Estado da apresentação, criação de elementos, área de transferência e histórico (undo/redo). */
(function () {
  'use strict';
  const App = (window.App = window.App || {});

  App.SLIDE_W = 1280;
  App.SLIDE_H = 720;
  App.FONT = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  let seq = 0;
  App.uid = () => 'e' + Date.now().toString(36) + (seq++).toString(36);

  App.state = { title: 'Minha apresentação', slides: [], current: 0, selection: [] };
  App.editingId = null;
  App.alignToSlide = false;
  App.dirty = false;

  const baseStyle = () => ({
    fill: 'transparent', stroke: 'transparent', strokeWidth: 0, radius: 0,
    color: '#1f2937', fontSize: 28, fontFamily: App.FONT, align: 'left', vAlign: 'top',
  });
  const shapeStyle = { fill: '#3b6cf6', stroke: '#1e40af', strokeWidth: 0, color: '#ffffff', align: 'center', vAlign: 'middle' };

  App.templates = {
    text: () => ({ type: 'text', w: 520, h: 60, html: 'Digite seu texto', style: {} }),
    rect: () => ({ type: 'shape', shape: 'rect', w: 260, h: 160, style: Object.assign({}, shapeStyle, { radius: 12 }) }),
    ellipse: () => ({ type: 'shape', shape: 'ellipse', w: 200, h: 200, style: Object.assign({}, shapeStyle) }),
    triangle: () => ({ type: 'shape', shape: 'triangle', w: 220, h: 190, style: Object.assign({}, shapeStyle, { vAlign: 'bottom' }) }),
    line: () => ({ type: 'shape', shape: 'line', w: 320, h: 16, style: { stroke: '#1f2937', strokeWidth: 4 } }),
    button: () => ({
      type: 'button', w: 200, h: 56, html: 'Saiba mais', link: '',
      style: { fill: '#3b6cf6', color: '#ffffff', fontSize: 20, radius: 10, align: 'center', vAlign: 'middle' },
    }),
  };

  App.make = (kind, props = {}, style = {}) => {
    const t = App.templates[kind]();
    return Object.assign({ id: App.uid(), x: 0, y: 0, z: 0, html: '' }, t, props, {
      style: Object.assign(baseStyle(), t.style, style),
    });
  };

  App.newSlide = withTitle => ({
    id: App.uid(),
    background: '#ffffff',
    elements: withTitle
      ? [App.make('text', { x: 80, y: 60, w: 1120, h: 80, z: 1, html: '<b>Título do slide</b>' }, { fontSize: 44 })]
      : [],
  });

  App.currentSlide = () => App.state.slides[App.state.current];
  App.getEl = id => App.currentSlide().elements.find(e => e.id === id);
  App.selectedEls = () => App.state.selection.map(App.getEl).filter(Boolean);
  App.maxZ = () => App.currentSlide().elements.reduce((m, e) => Math.max(m, e.z), 0);

  App.bbox = els => {
    const x = Math.min(...els.map(e => e.x)), y = Math.min(...els.map(e => e.y));
    const r = Math.max(...els.map(e => e.x + e.w)), b = Math.max(...els.map(e => e.y + e.h));
    return { x, y, w: r - x, h: b - y };
  };

  App.addElement = kind => {
    App.endEdit();
    const slide = App.currentSlide();
    const el = App.make(kind);
    el.x = Math.round((App.SLIDE_W - el.w) / 2);
    el.y = Math.round((App.SLIDE_H - el.h) / 2);
    while (slide.elements.some(e => e.x === el.x && e.y === el.y)) { el.x += 24; el.y += 24; }
    el.z = App.maxZ() + 1;
    slide.elements.push(el);
    App.state.selection = [el.id];
    App.commit();
    App.render();
    if (el.type === 'text') App.startEdit(el.id);
    return el;
  };

  App.deleteSelected = () => {
    const ids = new Set(App.state.selection);
    if (!ids.size) return;
    const slide = App.currentSlide();
    slide.elements = slide.elements.filter(e => !ids.has(e.id));
    App.state.selection = [];
    App.commit();
    App.render();
  };

  /* Ordem de empilhamento: front | back | forward | backward */
  App.reorder = dir => {
    const slide = App.currentSlide();
    const sel = new Set(App.state.selection);
    const els = slide.elements.slice().sort((a, b) => a.z - b.z);
    let out;
    if (dir === 'front') out = els.filter(e => !sel.has(e.id)).concat(els.filter(e => sel.has(e.id)));
    else if (dir === 'back') out = els.filter(e => sel.has(e.id)).concat(els.filter(e => !sel.has(e.id)));
    else {
      out = els;
      if (dir === 'forward') {
        for (let i = out.length - 2; i >= 0; i--) if (sel.has(out[i].id) && !sel.has(out[i + 1].id)) [out[i], out[i + 1]] = [out[i + 1], out[i]];
      } else {
        for (let i = 1; i < out.length; i++) if (sel.has(out[i].id) && !sel.has(out[i - 1].id)) [out[i], out[i - 1]] = [out[i - 1], out[i]];
      }
    }
    out.forEach((e, i) => { e.z = i + 1; });
    App.commit();
    App.render();
  };

  /* Área de transferência interna (funciona entre slides) */
  App.clipboard = null;
  let pasteCount = 0;
  App.copySelected = () => {
    const els = App.selectedEls();
    if (!els.length) return;
    App.clipboard = JSON.stringify(els);
    pasteCount = 0;
  };
  App.paste = (json = App.clipboard, offset) => {
    if (!json) return;
    const slide = App.currentSlide();
    let z = App.maxZ();
    if (offset === undefined) offset = 24 * ++pasteCount;
    const els = JSON.parse(json).sort((a, b) => a.z - b.z)
      .map(e => Object.assign(e, { id: App.uid(), x: e.x + offset, y: e.y + offset, z: ++z }));
    slide.elements.push(...els);
    App.state.selection = els.map(e => e.id);
    App.commit();
    App.render();
  };
  App.duplicateSelected = () => {
    const els = App.selectedEls();
    if (els.length) App.paste(JSON.stringify(els), 24);
  };

  /* Histórico: snapshots JSON; commit() só após uma alteração concluída */
  let undoStack = [], redoStack = [], last = null;
  const snap = () => JSON.stringify({ slides: App.state.slides, current: App.state.current });
  const restore = s => {
    const d = JSON.parse(s);
    App.state.slides = d.slides;
    App.state.current = Math.min(d.current, d.slides.length - 1);
    App.state.selection = App.state.selection.filter(id => App.getEl(id));
    last = s;
    App.dirty = true;
    App.render();
  };
  App.resetHistory = () => { undoStack = []; redoStack = []; last = snap(); App.dirty = false; };
  App.commit = () => {
    const s = snap();
    if (s === last) return;
    undoStack.push(last);
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
    last = s;
    App.dirty = true;
  };
  App.undo = () => { App.endEdit(); if (undoStack.length) { redoStack.push(last); restore(undoStack.pop()); } };
  App.redo = () => { App.endEdit(); if (redoStack.length) { undoStack.push(last); restore(redoStack.pop()); } };
  App.canUndo = () => undoStack.length > 0;
  App.canRedo = () => redoStack.length > 0;

  /* Utilidades de segurança/escape */
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  App.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);
  App.safeUrl = u => (/^\s*(javascript|data|vbscript):/i.test(u || '') ? '' : u || '');
  App.sanitize = html => {
    const t = document.createElement('template');
    t.innerHTML = html || '';
    t.content.querySelectorAll('script,style,iframe,object,embed,link,meta,form').forEach(n => n.remove());
    t.content.querySelectorAll('*').forEach(n => {
      [...n.attributes].forEach(a => {
        if (/^on/i.test(a.name) || /^\s*(javascript|vbscript):/i.test(a.value)) n.removeAttribute(a.name);
      });
    });
    return t.innerHTML;
  };
})();
