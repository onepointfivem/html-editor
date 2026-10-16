/* Alinhamento e distribuição de elementos + guias inteligentes durante o arrasto. */
(function () {
  'use strict';
  const App = window.App;
  const W = App.SLIDE_W, H = App.SLIDE_H;

  const svg = p => `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">${p}</svg>`;
  App.ALIGN_ICONS = {
    left: svg('<path d="M2 1.5v13"/><rect x="4" y="3.5" width="9" height="3" rx=".5"/><rect x="4" y="9.5" width="5" height="3" rx=".5"/>'),
    hcenter: svg('<path d="M8 1.5v13"/><rect x="3" y="3.5" width="10" height="3" rx=".5"/><rect x="5" y="9.5" width="6" height="3" rx=".5"/>'),
    right: svg('<path d="M14 1.5v13"/><rect x="3" y="3.5" width="9" height="3" rx=".5"/><rect x="7" y="9.5" width="5" height="3" rx=".5"/>'),
    top: svg('<path d="M1.5 2h13"/><rect x="3.5" y="4" width="3" height="9" rx=".5"/><rect x="9.5" y="4" width="3" height="5" rx=".5"/>'),
    middle: svg('<path d="M1.5 8h13"/><rect x="3.5" y="3" width="3" height="10" rx=".5"/><rect x="9.5" y="5" width="3" height="6" rx=".5"/>'),
    bottom: svg('<path d="M1.5 14h13"/><rect x="3.5" y="3" width="3" height="9" rx=".5"/><rect x="9.5" y="7" width="3" height="5" rx=".5"/>'),
    distH: svg('<path d="M1.5 2v12M14.5 2v12"/><rect x="6" y="4" width="4" height="8" rx=".5"/>'),
    distV: svg('<path d="M2 1.5h12M2 14.5h12"/><rect x="4" y="6" width="8" height="4" rx=".5"/>'),
  };

  const ALIGN = [
    ['left', 'Alinhar à esquerda (Alt+Shift+L)'],
    ['hcenter', 'Centralizar horizontalmente (Alt+Shift+C)'],
    ['right', 'Alinhar à direita (Alt+Shift+R)'],
    ['top', 'Alinhar ao topo (Alt+Shift+T)'],
    ['middle', 'Centralizar verticalmente (Alt+Shift+M)'],
    ['bottom', 'Alinhar à base (Alt+Shift+B)'],
  ];
  App.ALIGN_KEYS = { KeyL: 'left', KeyC: 'hcenter', KeyR: 'right', KeyT: 'top', KeyM: 'middle', KeyB: 'bottom' };

  App.alignPanelHTML = n => {
    const ic = App.ALIGN_ICONS;
    return `
      <div class="icon-row">${ALIGN.map(([k, t]) => `<button type="button" class="icon-btn" data-align="${k}" title="${t}" ${n < 1 ? 'disabled' : ''}>${ic[k]}</button>`).join('')}</div>
      <div class="dist-row">
        <button type="button" class="icon-btn wide" data-dist="h" title="Espaçamento horizontal igual (3+ elementos)" ${n < 3 ? 'disabled' : ''}>${ic.distH}<span>Distribuir horiz.</span></button>
        <button type="button" class="icon-btn wide" data-dist="v" title="Espaçamento vertical igual (3+ elementos)" ${n < 3 ? 'disabled' : ''}>${ic.distV}<span>Distribuir vert.</span></button>
      </div>
      <label class="chk"><input type="checkbox" data-align-slide ${App.alignToSlide || n === 1 ? 'checked' : ''} ${n <= 1 ? 'disabled' : ''}> Alinhar em relação ao slide</label>`;
  };

  /* Clique em botão de alinhar/distribuir (painel de propriedades ou menu da toolbar) */
  App.handleAlignClick = e => {
    const b = e.target.closest('[data-align],[data-dist]');
    if (!b || b.disabled) return false;
    if (b.dataset.align) App.align(b.dataset.align);
    else App.distribute(b.dataset.dist);
    return true;
  };

  App.align = mode => {
    App.endEdit();
    const els = App.selectedEls();
    if (!els.length) return;
    const ref = els.length === 1 || App.alignToSlide ? { x: 0, y: 0, w: W, h: H } : App.bbox(els);
    els.forEach(el => {
      switch (mode) {
        case 'left': el.x = ref.x; break;
        case 'hcenter': el.x = Math.round(ref.x + (ref.w - el.w) / 2); break;
        case 'right': el.x = ref.x + ref.w - el.w; break;
        case 'top': el.y = ref.y; break;
        case 'middle': el.y = Math.round(ref.y + (ref.h - el.h) / 2); break;
        case 'bottom': el.y = ref.y + ref.h - el.h; break;
      }
    });
    App.commit();
    App.render();
  };

  /* Espaços iguais entre elementos, mantendo os extremos no lugar */
  App.distribute = axis => {
    App.endEdit();
    const els = App.selectedEls();
    if (els.length < 3) return;
    const [p, s] = axis === 'h' ? ['x', 'w'] : ['y', 'h'];
    els.sort((a, b) => a[p] - b[p]);
    const start = els[0][p];
    const end = Math.max(...els.map(e => e[p] + e[s]));
    const gap = (end - start - els.reduce((t, e) => t + e[s], 0)) / (els.length - 1);
    let cur = start;
    els.forEach(e => { e[p] = Math.round(cur); cur += e[s] + gap; });
    App.commit();
    App.render();
  };

  /* Guias inteligentes: encaixa bordas/centros do grupo em bordas/centros de outros elementos e do slide */
  App.snapMove = (box, exclude) => {
    const th = 6 / App.scale;
    const xs = [0, W / 2, W], ys = [0, H / 2, H];
    App.currentSlide().elements.forEach(o => {
      if (exclude.includes(o.id)) return;
      xs.push(o.x, o.x + o.w / 2, o.x + o.w);
      ys.push(o.y, o.y + o.h / 2, o.y + o.h);
    });
    const axis = (targets, edges) => {
      let best = null;
      for (const t of targets) for (const e of edges) {
        const d = t - e;
        if (Math.abs(d) <= th && (best === null || Math.abs(d) < Math.abs(best))) best = d;
      }
      if (best === null) return { d: 0, lines: [] };
      const lines = [...new Set(targets.filter(t => edges.some(e => Math.abs(t - (e + best)) < 0.5)))];
      return { d: best, lines };
    };
    const ax = axis(xs, [box.x, box.x + box.w / 2, box.x + box.w]);
    const ay = axis(ys, [box.y, box.y + box.h / 2, box.y + box.h]);
    return { dx: ax.d, dy: ay.d, vLines: ax.lines, hLines: ay.lines };
  };

  App.showGuides = (vLines = [], hLines = []) => {
    const g = document.getElementById('guides');
    if (!g) return;
    g.innerHTML = vLines.map(x => `<div class="guide v" style="left:${x}px"></div>`).join('') +
      hLines.map(y => `<div class="guide h" style="top:${y}px"></div>`).join('');
  };
})();
