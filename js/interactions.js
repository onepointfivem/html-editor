/* Seleção, mover, redimensionar, seleção por área e atalhos de teclado. */
(function () {
  'use strict';
  const App = window.App;
  let drag = null;
  let nudgeTimer = null;

  const slideNode = () => document.getElementById('slide');
  const toSlide = e => {
    const r = slideNode().getBoundingClientRect();
    return { x: (e.clientX - r.left) / App.scale, y: (e.clientY - r.top) / App.scale };
  };
  const selectionChanged = () => { App.renderSelection(); App.renderProps(); App.updateToolbar(); };

  function onDown(e) {
    if (e.button !== 0) return;
    const target = e.target;
    const elNode = target.closest('.el');
    if (elNode && elNode.dataset.id === App.editingId) return; // clique dentro do texto em edição
    e.preventDefault();
    const active = document.activeElement;
    if (active && active !== document.body) active.blur();

    const p = toSlide(e);
    const sel = App.state.selection;
    const handle = target.closest('.handle');
    if (handle) {
      const el = App.selectedEls()[0];
      if (!el) return;
      drag = { mode: 'resize', dir: handle.dataset.dir, start: p, el, orig: { x: el.x, y: el.y, w: el.w, h: el.h } };
    } else if (elNode) {
      const id = elNode.dataset.id;
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      if (additive) {
        const i = sel.indexOf(id);
        if (i >= 0) { sel.splice(i, 1); selectionChanged(); return; }
        sel.push(id);
      } else if (!sel.includes(id)) {
        App.state.selection = [id];
      }
      selectionChanged();
      const els = App.selectedEls();
      drag = { mode: 'move', start: p, clicked: id, additive, els, orig: els.map(o => ({ x: o.x, y: o.y })), box: App.bbox(els) };
    } else {
      const base = e.shiftKey ? sel.slice() : [];
      App.state.selection = base.slice();
      selectionChanged();
      drag = { mode: 'marquee', start: p, base };
    }
    drag.moved = false;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  }

  function onMove(e) {
    if (!drag) return;
    const p = toSlide(e);
    let dx = p.x - drag.start.x, dy = p.y - drag.start.y;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) * App.scale < 3) return;
      drag.moved = true;
      document.body.classList.add('dragging');
    }

    if (drag.mode === 'move') {
      let lockX = false, lockY = false;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) { dy = 0; lockY = true; } else { dx = 0; lockX = true; } }
      let v = [], h = [];
      if (!e.altKey) {
        const b = drag.box;
        const s = App.snapMove({ x: b.x + dx, y: b.y + dy, w: b.w, h: b.h }, drag.els.map(o => o.id));
        if (!lockX) { dx += s.dx; v = s.vLines; }
        if (!lockY) { dy += s.dy; h = s.hLines; }
      }
      drag.els.forEach((o, i) => {
        o.x = Math.round(drag.orig[i].x + dx);
        o.y = Math.round(drag.orig[i].y + dy);
        App.updateElementDOM(o);
      });
      App.showGuides(v, h);
      App.renderSelection();
    } else if (drag.mode === 'resize') {
      resize(drag, dx, dy, e.shiftKey);
      App.updateElementDOM(drag.el);
      App.renderSelection();
    } else {
      const x = Math.min(p.x, drag.start.x), y = Math.min(p.y, drag.start.y);
      const w = Math.abs(p.x - drag.start.x), h = Math.abs(p.y - drag.start.y);
      let m = document.getElementById('marquee');
      if (!m) { m = document.createElement('div'); m.id = 'marquee'; slideNode().appendChild(m); }
      Object.assign(m.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      const hit = App.currentSlide().elements
        .filter(o => o.x < x + w && o.x + o.w > x && o.y < y + h && o.y + o.h > y)
        .map(o => o.id);
      App.state.selection = [...new Set(drag.base.concat(hit))];
      App.renderSelection();
    }
  }

  function onUp() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    const d = drag;
    drag = null;
    if (!d) return;
    document.body.classList.remove('dragging');
    App.showGuides();
    const m = document.getElementById('marquee');
    if (m) m.remove();
    if (d.mode === 'marquee') { App.renderProps(); App.updateToolbar(); return; }
    if (d.moved) {
      App.commit();
      App.renderThumbs();
      App.renderProps();
      App.updateToolbar();
    } else if (d.mode === 'move' && !d.additive && App.state.selection.length > 1) {
      App.state.selection = [d.clicked];
      selectionChanged();
    }
  }

  /* Redimensiona pela alça `dir`; Shift mantém a proporção */
  function resize(d, dx, dy, keepRatio) {
    const o = d.orig, dir = d.dir, el = d.el;
    let w = o.w, h = o.h;
    if (dir.includes('e')) w = o.w + dx;
    if (dir.includes('w')) w = o.w - dx;
    if (dir.includes('s')) h = o.h + dy;
    if (dir.includes('n')) h = o.h - dy;
    w = Math.max(12, w);
    h = Math.max(el.shape === 'line' ? 4 : 12, h);
    if (keepRatio && el.shape !== 'line') {
      const r = o.w / o.h;
      if (dir.length === 2) { if (w / h > r) h = w / r; else w = h * r; }
      else if (dir === 'e' || dir === 'w') h = w / r;
      else w = h * r;
    }
    el.w = Math.round(w);
    el.h = Math.round(h);
    el.x = dir.includes('w') ? o.x + o.w - el.w : o.x;
    el.y = dir.includes('n') ? o.y + o.h - el.h : o.y;
  }

  function nudge(dx, dy) {
    const els = App.selectedEls();
    if (!els.length) return;
    els.forEach(o => { o.x += dx; o.y += dy; App.updateElementDOM(o); });
    App.renderSelection();
    clearTimeout(nudgeTimer);
    nudgeTimer = setTimeout(() => { App.commit(); App.renderThumbs(); App.renderProps(); App.updateToolbar(); }, 350);
  }

  function onKey(e) {
    if (App.isPresenting) return;
    if (App.editingId) {
      if (e.key === 'Escape') { e.preventDefault(); App.endEdit(); }
      return;
    }
    if (e.target.matches('input,textarea,select,[contenteditable="true"]')) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();

    if (e.altKey && e.shiftKey && App.ALIGN_KEYS[e.code]) { e.preventDefault(); App.align(App.ALIGN_KEYS[e.code]); return; }
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); App.undo(); return; }
    if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); App.redo(); return; }
    if (mod && k === 'c') { App.copySelected(); return; }
    if (mod && k === 'x') { App.copySelected(); App.deleteSelected(); return; }
    if (mod && k === 'v') { e.preventDefault(); App.paste(); return; }
    if (mod && k === 'd') { e.preventDefault(); App.duplicateSelected(); return; }
    if (mod && k === 'a') { e.preventDefault(); App.state.selection = App.currentSlide().elements.map(o => o.id); selectionChanged(); return; }

    const step = e.shiftKey ? 10 : 1;
    switch (e.key) {
      case 'Delete':
      case 'Backspace': e.preventDefault(); App.deleteSelected(); break;
      case 'ArrowLeft': e.preventDefault(); nudge(-step, 0); break;
      case 'ArrowRight': e.preventDefault(); nudge(step, 0); break;
      case 'ArrowUp': e.preventDefault(); nudge(0, -step); break;
      case 'ArrowDown': e.preventDefault(); nudge(0, step); break;
      case 'Enter':
      case 'F2':
        if (App.state.selection.length === 1) { e.preventDefault(); App.startEdit(App.state.selection[0]); }
        break;
      case 'Escape': App.state.selection = []; selectionChanged(); break;
      case 'PageDown': e.preventDefault(); App.goToSlide(App.state.current + 1); break;
      case 'PageUp': e.preventDefault(); App.goToSlide(App.state.current - 1); break;
      case 'F5': e.preventDefault(); App.startPresentation(e.shiftKey ? App.state.current : 0); break;
    }
  }

  App.initInteractions = () => {
    const stage = document.getElementById('stage');
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('dblclick', e => {
      const n = e.target.closest('.el');
      if (n && n.dataset.id !== App.editingId) App.startEdit(n.dataset.id);
    });
    document.addEventListener('keydown', onKey);
  };
})();
