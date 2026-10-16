/* Renderização: elementToHTML é compartilhado entre editor, miniaturas, apresentação e exportação. */
(function () {
  'use strict';
  const App = window.App;
  const esc = App.esc;
  const W = App.SLIDE_W, H = App.SLIDE_H;

  /* CSS dos elementos — usado no editor e embutido no HTML exportado */
  App.ELEMENT_CSS = `
.slide{position:relative;width:${W}px;height:${H}px;background:#fff;}
.el{position:absolute;box-sizing:border-box;}
.el>svg{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none;}
.el-content{position:absolute;inset:0;display:flex;flex-direction:column;padding:8px 14px;box-sizing:border-box;}
.el-text{width:100%;outline:none;line-height:1.25;overflow-wrap:break-word;}
.el-text p,.el-text div{margin:0;}
.el-text ul,.el-text ol{margin:0;padding-left:1.3em;}
a.el{display:block;text-decoration:none;cursor:pointer;}
a.type-button{transition:filter .15s,transform .15s;}
a.type-button:hover{filter:brightness(1.1);transform:translateY(-1px);}
`;

  const V_ALIGN = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
  const visible = c => c && c !== 'transparent';

  App.shapeSVG = el => {
    const s = el.style, w = el.w, h = el.h;
    const sw = visible(s.stroke) ? +s.strokeWidth || 0 : 0;
    const half = sw / 2;
    const fill = `fill="${esc(visible(s.fill) ? s.fill : 'none')}"`;
    const stroke = sw ? `stroke="${esc(s.stroke)}" stroke-width="${sw}"` : 'stroke="none"';
    let body;
    switch (el.shape) {
      case 'ellipse':
        body = `<ellipse cx="${w / 2}" cy="${h / 2}" rx="${Math.max(0, w / 2 - half)}" ry="${Math.max(0, h / 2 - half)}" ${fill} ${stroke}/>`;
        break;
      case 'triangle':
        body = `<polygon points="${w / 2},${half} ${w - half},${h - half} ${half},${h - half}" ${fill} ${stroke} stroke-linejoin="round"/>`;
        break;
      case 'line':
        body = `<line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="${esc(visible(s.stroke) ? s.stroke : '#1f2937')}" stroke-width="${Math.max(1, +s.strokeWidth || 1)}" stroke-linecap="round"/>`;
        break;
      default:
        body = `<rect x="${half}" y="${half}" width="${Math.max(0, w - sw)}" height="${Math.max(0, h - sw)}" rx="${Math.min(+s.radius || 0, w / 2, h / 2)}" ${fill} ${stroke}/>`;
    }
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  };

  /* mode: 'edit' | 'thumb' | 'view' (apresentação/exportação: botões viram links) */
  App.elementToHTML = (el, mode) => {
    const s = el.style;
    let style = `left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;z-index:${el.z};`;
    let inner = '';
    if (el.type === 'shape') {
      inner += App.shapeSVG(el);
    } else {
      style += `background:${s.fill || 'transparent'};border-radius:${+s.radius || 0}px;`;
      if (visible(s.stroke) && +s.strokeWidth > 0) style += `border:${+s.strokeWidth}px solid ${s.stroke};`;
    }
    if (el.shape !== 'line') {
      const cs = `justify-content:${V_ALIGN[s.vAlign] || 'flex-start'};color:${s.color};font-size:${+s.fontSize}px;font-family:${s.fontFamily};text-align:${s.align};`;
      inner += `<div class="el-content" style="${esc(cs)}"><div class="el-text">${el.html || ''}</div></div>`;
    }
    const attrs = `class="el type-${el.type}${el.shape ? ' shape-' + el.shape : ''}" data-id="${esc(el.id)}" style="${esc(style)}"`;
    const link = App.safeUrl(el.link);
    if (el.type === 'button' && mode === 'view' && link) {
      const ext = /^#/.test(link) ? '' : ' target="_blank" rel="noopener"';
      return `<a ${attrs} href="${esc(link)}"${ext}>${inner}</a>`;
    }
    return `<div ${attrs}>${inner}</div>`;
  };

  App.slideInnerHTML = (slide, mode) =>
    slide.elements.slice().sort((a, b) => a.z - b.z).map(e => App.elementToHTML(e, mode)).join('');

  const slideNode = () => document.getElementById('slide');

  /* Escala o slide 1280×720 para caber na área central */
  App.scale = 1;
  App.fitStage = () => {
    const stage = document.getElementById('stage');
    const pad = 64;
    const k = Math.max(0.1, Math.min((stage.clientWidth - pad) / W, (stage.clientHeight - pad) / H));
    App.scale = k;
    const wrap = document.getElementById('slide-wrap');
    wrap.style.width = W * k + 'px';
    wrap.style.height = H * k + 'px';
    const sl = slideNode();
    sl.style.transform = `scale(${k})`;
    sl.style.setProperty('--inv', 1 / k);
    if (App.positionTextbar) App.positionTextbar();
  };

  App.renderSlide = () => {
    const slide = App.currentSlide();
    const sl = slideNode();
    sl.style.background = slide.background;
    sl.innerHTML = App.slideInnerHTML(slide, 'edit') + '<div id="guides"></div><div id="sel-overlay" hidden></div>';
    App.renderSelection();
  };

  /* Atualiza apenas classes de seleção e a caixa com alças (não recria elementos) */
  App.renderSelection = () => {
    const sl = slideNode();
    sl.querySelectorAll('.el.selected').forEach(n => n.classList.remove('selected'));
    const sel = App.selectedEls();
    sel.forEach(e => {
      const n = sl.querySelector(`.el[data-id="${e.id}"]`);
      if (n) n.classList.add('selected');
    });
    const ov = document.getElementById('sel-overlay');
    if (!ov) return;
    if (!sel.length) { ov.hidden = true; return; }
    const b = sel.length === 1 ? sel[0] : App.bbox(sel);
    ov.hidden = false;
    ov.className = sel.length === 1 ? 'single' : 'multi';
    Object.assign(ov.style, { left: b.x + 'px', top: b.y + 'px', width: b.w + 'px', height: b.h + 'px' });
    let dirs = [];
    if (sel.length === 1 && !App.editingId) {
      dirs = sel[0].shape === 'line' ? ['w', 'e'] : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    }
    ov.innerHTML = dirs.map(d => `<div class="handle h-${d}" data-dir="${d}"></div>`).join('');
  };

  /* Atualização rápida de um elemento durante arrastar/redimensionar */
  App.updateElementDOM = el => {
    const n = slideNode().querySelector(`.el[data-id="${el.id}"]`);
    if (n) n.outerHTML = App.elementToHTML(el, 'edit');
  };

  App.render = () => {
    App.renderSlide();
    App.renderThumbs();
    App.renderProps();
    App.updateToolbar();
  };
})();
