/* Edição de texto in-place (contenteditable) com mini barra de formatação. */
(function () {
  'use strict';
  const App = window.App;
  const SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 56, 64, 72, 88, 104, 120, 144];
  let savedRange = null;

  const bar = () => document.getElementById('textbar');
  const elNode = id => document.querySelector(`#slide .el[data-id="${id}"]`);
  const editNode = () => {
    const n = App.editingId && elNode(App.editingId);
    return n ? n.querySelector('.el-text') : null;
  };

  App.startEdit = id => {
    const el = App.getEl(id);
    if (!el || el.shape === 'line') return;
    if (App.editingId) App.endEdit();
    const node = elNode(id) && elNode(id).querySelector('.el-text');
    if (!node) return;
    App.editingId = id;
    App.state.selection = [id];
    App.renderSelection();
    App.renderProps();
    App.updateToolbar();

    node.closest('.el').classList.add('editing');
    node.contentEditable = 'true';
    node.focus();
    const r = document.createRange();
    r.selectNodeContents(node);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
    try { document.execCommand('styleWithCSS', false, true); } catch (_) { /* navegador sem suporte */ }

    bar().hidden = false;
    syncBar();
    App.positionTextbar();
  };

  App.endEdit = () => {
    const id = App.editingId;
    if (!id) return;
    const node = editNode();
    App.editingId = null;
    const el = App.getEl(id);
    if (node && el) {
      let html = App.sanitize(node.innerHTML).trim();
      if (/^(<br\s*\/?>)?$/i.test(html)) html = '';
      el.html = html;
    }
    bar().hidden = true;
    savedRange = null;
    const s = getSelection();
    if (s) s.removeAllRanges();
    App.commit();
    App.render();
  };

  App.positionTextbar = () => {
    const b = bar();
    if (b.hidden || !App.editingId) return;
    const n = elNode(App.editingId);
    if (!n) return;
    const r = n.getBoundingClientRect();
    const stage = document.getElementById('stage').getBoundingClientRect();
    const bh = b.offsetHeight, bw = b.offsetWidth;
    let top = r.top - bh - 12;
    if (top < stage.top + 6) top = Math.min(r.bottom + 12, stage.bottom - bh - 6);
    const left = Math.max(stage.left + 8, Math.min(r.left + r.width / 2 - bw / 2, stage.right - bw - 8));
    b.style.top = top + 'px';
    b.style.left = left + 'px';
  };

  function saveRange() {
    const n = editNode(), s = getSelection();
    if (n && s.rangeCount && n.contains(s.getRangeAt(0).commonAncestorContainer)) savedRange = s.getRangeAt(0).cloneRange();
  }
  function restoreRange() {
    const n = editNode();
    if (!n) return;
    n.focus();
    if (savedRange) {
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(savedRange);
    }
  }
  function exec(cmd, val) {
    restoreRange();
    document.execCommand(cmd, false, val);
    saveRange();
    syncBar();
  }

  /* Caixas de texto crescem na altura conforme o conteúdo */
  function autoGrow() {
    const el = App.getEl(App.editingId), n = editNode();
    if (!el || !n || el.type !== 'text') return;
    const cs = getComputedStyle(n.parentElement);
    const border = el.style.stroke !== 'transparent' ? 2 * (+el.style.strokeWidth || 0) : 0;
    const need = Math.ceil(n.offsetHeight + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + border);
    if (need > el.h) {
      el.h = need;
      elNode(el.id).style.height = need + 'px';
      App.renderSelection();
    }
  }

  function applyLive(el) {
    const n = editNode();
    if (!n) return;
    n.parentElement.style.fontSize = el.style.fontSize + 'px';
    n.parentElement.style.textAlign = el.style.align;
    autoGrow();
    App.positionTextbar();
  }

  function syncBar() {
    const el = App.getEl(App.editingId);
    if (!el) return;
    const b = bar();
    b.querySelector('#tb-size').textContent = el.style.fontSize;
    b.querySelectorAll('[data-align-text]').forEach(x => x.classList.toggle('on', x.dataset.alignText === el.style.align));
    b.querySelectorAll('[data-cmd]').forEach(x => {
      let on = false;
      try { on = document.queryCommandState(x.dataset.cmd); } catch (_) { /* ignora */ }
      x.classList.toggle('on', on);
    });
  }

  App.initTextEdit = () => {
    const b = bar();
    const slide = document.getElementById('slide');

    // Mantém o foco/seleção no texto ao clicar na barra
    b.addEventListener('mousedown', e => { if (!e.target.closest('input')) e.preventDefault(); });
    b.addEventListener('click', e => {
      const btn = e.target.closest('button');
      const el = App.getEl(App.editingId);
      if (!btn || !el) return;
      if (btn.dataset.cmd) exec(btn.dataset.cmd);
      else if (btn.dataset.size) {
        const cur = +el.style.fontSize;
        el.style.fontSize = btn.dataset.size === '1'
          ? (SIZES.find(s => s > cur) || cur + 8)
          : (SIZES.slice().reverse().find(s => s < cur) || Math.max(6, cur - 2));
        applyLive(el);
      } else if (btn.dataset.alignText) {
        el.style.align = btn.dataset.alignText;
        applyLive(el);
      }
      syncBar();
    });
    b.querySelector('#tb-color').addEventListener('change', e => exec('foreColor', e.target.value));

    // Termina a edição ao clicar fora do texto e da barra
    document.addEventListener('pointerdown', e => {
      if (!App.editingId) return;
      if (e.target.closest('#textbar') || e.target.closest(`.el[data-id="${App.editingId}"]`)) return;
      App.endEdit();
    }, true);

    document.addEventListener('selectionchange', () => { if (App.editingId) { saveRange(); syncBar(); } });
    slide.addEventListener('input', autoGrow);
    // Colar como texto simples, para não trazer estilos externos
    slide.addEventListener('paste', e => {
      if (!App.editingId) return;
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    });
  };
})();
