/* Painel de propriedades (direita): elemento(s) selecionado(s) ou o slide atual. */
(function () {
  'use strict';
  const App = window.App;
  const esc = App.esc;

  const FONTS = [
    ['Segoe UI', App.FONT],
    ['Arial', 'Arial, Helvetica, sans-serif'],
    ['Verdana', 'Verdana, Geneva, sans-serif'],
    ['Trebuchet', "'Trebuchet MS', sans-serif"],
    ['Georgia', "Georgia, 'Times New Roman', serif"],
    ['Courier', "'Courier New', monospace"],
    ['Impact', 'Impact, Haettenschweiler, sans-serif'],
  ];
  const BACKGROUNDS = [
    '#ffffff', '#f8fafc', '#fef3c7', '#ecfdf5', '#0f172a', '#1e3a8a',
    'linear-gradient(135deg,#667eea,#764ba2)', 'linear-gradient(135deg,#0f172a,#334155)',
    'linear-gradient(135deg,#f6d365,#fda085)', 'linear-gradient(135deg,#43e97b,#38f9d7)',
    'linear-gradient(135deg,#fdfbfb,#ebedee)', 'linear-gradient(135deg,#ff9a9e,#fecfef)',
  ];

  const svg = p => `<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">${p}</svg>`;
  const TEXT_ALIGN = [
    ['left', svg('<path d="M2 3.5h12M2 6.5h8M2 9.5h12M2 12.5h8"/>'), 'Esquerda'],
    ['center', svg('<path d="M2 3.5h12M4 6.5h8M2 9.5h12M4 12.5h8"/>'), 'Centro'],
    ['right', svg('<path d="M2 3.5h12M6 6.5h8M2 9.5h12M6 12.5h8"/>'), 'Direita'],
    ['justify', svg('<path d="M2 3.5h12M2 6.5h12M2 9.5h12M2 12.5h12"/>'), 'Justificado'],
  ];
  const V_ALIGN = [['top', 'Topo', 'Topo'], ['middle', 'Meio', 'Meio'], ['bottom', 'Base', 'Base']];
  const ORDER = [['front', 'Trazer para frente'], ['forward', 'Avançar'], ['backward', 'Recuar'], ['back', 'Enviar para trás']];

  const isNone = c => !c || c === 'transparent';
  const hex = c => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '#ffffff');
  const section = (title, body) => `<div class="p-section"><div class="p-title">${title}</div>${body}</div>`;
  const row = (label, body) => `<div class="row"><span class="lbl">${label}</span>${body}</div>`;
  const num = (prop, label, v, attrs = '') =>
    `<label class="num" title="${label}"><span>${label}</span><input type="number" data-prop="${prop}" value="${Math.round((+v || 0) * 100) / 100}" ${attrs}></label>`;
  const color = (prop, v, allowNone, target = '') =>
    `<div class="color-field"><input type="color" data-prop="${prop}" ${target} value="${hex(v)}">` +
    (allowNone ? `<label class="chk"><input type="checkbox" data-none="${prop}" ${isNone(v) ? 'checked' : ''}> Nenhum</label>` : '') +
    '</div>';
  const seg = (prop, cur, opts) =>
    `<div class="seg">${opts.map(([v, label, t]) => `<button type="button" data-set="${prop}" data-value="${v}" title="${t}" class="${cur === v ? 'on' : ''}">${label}</button>`).join('')}</div>`;

  const TYPE_NAMES = { text: 'Texto', button: 'Botão', rect: 'Retângulo', ellipse: 'Elipse', triangle: 'Triângulo', line: 'Linha' };

  function elementProps(sel) {
    const el = sel[0], s = el.style, single = sel.length === 1;
    const allLines = sel.every(e => e.shape === 'line');
    const hasText = sel.every(e => e.shape !== 'line');
    let h = '';

    const title = single ? TYPE_NAMES[el.shape || el.type] : `${sel.length} elementos`;
    h += `<div class="p-head"><strong>${title}</strong><button type="button" class="btn danger" data-action="delete">Excluir</button></div>`;

    if (single) {
      h += section('Posição e tamanho', `<div class="p-grid">
        ${num('x', 'X', el.x)}${num('y', 'Y', el.y)}
        ${num('w', 'L', el.w, 'min="12"')}${num('h', 'A', el.h, 'min="4"')}</div>`);
    }

    if (!allLines) h += section('Preenchimento', color('style.fill', s.fill, true));

    let border = row('Cor', color('style.stroke', s.stroke, !allLines)) +
      row('Espessura', num('style.strokeWidth', 'px', s.strokeWidth, 'min="0" max="60"'));
    if (single && (el.type !== 'shape' || el.shape === 'rect')) border += row('Cantos', num('style.radius', 'px', s.radius, 'min="0"'));
    h += section(allLines ? 'Linha' : 'Borda', border);

    if (hasText) {
      const fonts = FONTS.map(([n, v]) => `<option value="${esc(v)}" ${v === s.fontFamily ? 'selected' : ''}>${n}</option>`).join('');
      h += section('Texto',
        row('Fonte', `<select data-prop="style.fontFamily">${fonts}</select>`) +
        row('Tamanho', num('style.fontSize', 'px', s.fontSize, 'min="6" max="400"') + color('style.color', s.color, false)) +
        row('Alinhar', seg('style.align', s.align, TEXT_ALIGN)) +
        row('Vertical', seg('style.vAlign', s.vAlign, V_ALIGN)) +
        '<p class="hint">Duplo clique no elemento para editar o texto.</p>');
    }

    if (single && el.type === 'button') {
      h += section('Link do botão',
        `<input type="text" data-prop="link" value="${esc(el.link || '')}" placeholder="https://... ou #3 (ir ao slide 3)">` +
        '<p class="hint">Funciona no modo apresentação e no HTML exportado.</p>');
    }

    h += section('Organizar', `<div class="order-grid">${ORDER.map(([k, t]) => `<button type="button" class="btn" data-order="${k}">${t}</button>`).join('')}</div>`);
    h += section('Alinhar', App.alignPanelHTML(sel.length));
    return h;
  }

  function slideProps() {
    const slide = App.currentSlide();
    const t = 'data-target="slide"';
    return section(`Slide ${App.state.current + 1} de ${App.state.slides.length}`,
      row('Fundo', color('background', slide.background, false, t)) +
      `<div class="swatches">${BACKGROUNDS.map(b => `<button type="button" class="swatch" data-bg="${esc(b)}" style="background:${esc(b)}" title="${esc(b)}"></button>`).join('')}</div>` +
      row('CSS', `<input type="text" data-prop="background" ${t} value="${esc(slide.background)}" placeholder="linear-gradient(...)">`)) +
      section('Atalhos', `<div class="hint shortcuts">
        <div><kbd>Duplo clique</kbd> editar texto</div>
        <div><kbd>Shift</kbd>+clique seleção múltipla</div>
        <div><kbd>Shift</kbd> arrastar: trava eixo / mantém proporção</div>
        <div><kbd>Alt</kbd> arrastar sem encaixe</div>
        <div><kbd>Setas</kbd> mover (Shift = 10px)</div>
        <div><kbd>Ctrl</kbd>+<kbd>C</kbd>/<kbd>V</kbd>/<kbd>D</kbd> copiar / colar / duplicar</div>
        <div><kbd>Ctrl</kbd>+<kbd>Z</kbd>/<kbd>Y</kbd> desfazer / refazer</div>
        <div><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>L C R T M B</kbd> alinhar</div>
        <div><kbd>PgUp</kbd>/<kbd>PgDn</kbd> trocar slide · <kbd>F5</kbd> apresentar</div>
      </div>`);
  }

  App.renderProps = () => {
    const sel = App.selectedEls();
    document.getElementById('props').innerHTML = sel.length ? elementProps(sel) : slideProps();
  };

  const setPath = (obj, path, v) => {
    const ks = path.split('.');
    const last = ks.pop();
    ks.reduce((o, k) => o[k], obj)[last] = v;
  };

  function apply(node, value) {
    const prop = node.dataset.prop || node.dataset.none || node.dataset.set;
    const targets = node.dataset.target === 'slide' ? [App.currentSlide()] : App.selectedEls();
    targets.forEach(t => {
      let v = value;
      if (prop === 'w') v = Math.max(12, v);
      if (prop === 'h') v = Math.max(t.shape === 'line' ? 4 : 12, v);
      if (prop === 'style.strokeWidth' || prop === 'style.radius') v = Math.max(0, v);
      if (prop === 'style.fontSize') v = Math.max(6, v);
      if (prop === 'link') v = App.safeUrl(v.trim());
      // Escolher uma cor de borda torna a borda visível
      if (prop === 'style.stroke' && v !== 'transparent' && !(+t.style.strokeWidth)) t.style.strokeWidth = 2;
      setPath(t, prop, v);
    });
    App.renderSlide();
  }

  App.initProps = () => {
    const p = document.getElementById('props');

    p.addEventListener('input', e => {
      const n = e.target;
      if (!n.matches('[data-prop]')) return;
      let v = n.value;
      if (n.type === 'number') { v = parseFloat(v); if (isNaN(v)) return; }
      if (n.type === 'color') {
        const chk = n.parentElement.querySelector('[data-none]');
        if (chk) chk.checked = false;
      }
      apply(n, v);
    });

    p.addEventListener('change', e => {
      const n = e.target;
      if (n.matches('[data-align-slide]')) { App.alignToSlide = n.checked; App.updateToolbar(); return; }
      if (n.matches('[data-none]')) {
        apply(n, n.checked ? 'transparent' : n.closest('.color-field').querySelector('input[type=color]').value);
      } else if (n.matches('select[data-prop]')) {
        apply(n, n.value);
      } else if (!n.matches('[data-prop]')) return;
      App.commit();
      App.renderThumbs();
      App.updateToolbar();
      if (n.type === 'color' || n.type === 'checkbox' || n.dataset.target === 'slide') App.renderProps();
    });

    p.addEventListener('click', e => {
      if (App.handleAlignClick(e)) return;
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.set) { apply(b, b.dataset.value); App.commit(); App.render(); }
      else if (b.dataset.order) App.reorder(b.dataset.order);
      else if (b.dataset.bg) { App.currentSlide().background = b.dataset.bg; App.commit(); App.render(); }
      else if (b.dataset.action) App.actions[b.dataset.action]();
    });
  };
})();
