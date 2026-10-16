/* Painel lateral de slides: miniaturas, adicionar, duplicar, excluir e reordenar. */
(function () {
  'use strict';
  const App = window.App;
  const esc = App.esc;
  const THUMB_W = 176;
  const TS = THUMB_W / App.SLIDE_W;
  let dragFrom = null;

  App.renderThumbs = () => {
    const cur = App.state.current;
    document.getElementById('slide-list').innerHTML = App.state.slides.map((s, i) => `
      <div class="thumb${i === cur ? ' active' : ''}" draggable="true" data-index="${i}">
        <span class="num">${i + 1}</span>
        <div class="thumb-frame">
          <div class="slide" style="background:${esc(s.background)};transform:scale(${TS})">${App.slideInnerHTML(s, 'thumb')}</div>
        </div>
        <div class="thumb-actions">
          <button type="button" data-act="dup" title="Duplicar slide">⧉</button>
          <button type="button" data-act="del" title="Excluir slide" ${App.state.slides.length < 2 ? 'disabled' : ''}>✕</button>
        </div>
      </div>`).join('');
  };

  App.goToSlide = i => {
    App.endEdit();
    if (i < 0 || i >= App.state.slides.length) return;
    App.state.current = i;
    App.state.selection = [];
    App.render();
    const t = document.querySelector('.thumb.active');
    if (t) t.scrollIntoView({ block: 'nearest' });
  };

  App.addSlide = () => {
    App.endEdit();
    App.state.slides.splice(App.state.current + 1, 0, App.newSlide(true));
    App.state.current++;
    App.state.selection = [];
    App.commit();
    App.goToSlide(App.state.current);
  };

  App.duplicateSlide = i => {
    App.endEdit();
    const copy = JSON.parse(JSON.stringify(App.state.slides[i]));
    copy.id = App.uid();
    copy.elements.forEach(e => { e.id = App.uid(); });
    App.state.slides.splice(i + 1, 0, copy);
    App.state.current = i + 1;
    App.commit();
    App.goToSlide(i + 1);
  };

  App.deleteSlide = i => {
    App.endEdit();
    if (App.state.slides.length < 2) return;
    App.state.slides.splice(i, 1);
    let cur = App.state.current;
    if (i < cur || cur >= App.state.slides.length) cur--;
    App.state.current = Math.max(0, cur);
    App.commit();
    App.goToSlide(App.state.current);
  };

  App.moveSlide = (from, to) => {
    if (from === to) return;
    const [s] = App.state.slides.splice(from, 1);
    App.state.slides.splice(to, 0, s);
    App.state.current = to;
    App.commit();
    App.goToSlide(to);
  };

  const clearDrop = () => document.querySelectorAll('.drop-before,.drop-after').forEach(n => n.classList.remove('drop-before', 'drop-after'));

  App.initSlides = () => {
    const list = document.getElementById('slide-list');

    list.addEventListener('click', e => {
      const t = e.target.closest('.thumb');
      if (!t) return;
      const i = +t.dataset.index;
      const act = e.target.closest('[data-act]');
      if (act) {
        if (act.dataset.act === 'dup') App.duplicateSlide(i);
        else App.deleteSlide(i);
      } else App.goToSlide(i);
    });

    list.addEventListener('dragstart', e => {
      const t = e.target.closest('.thumb');
      if (!t) return;
      dragFrom = +t.dataset.index;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(dragFrom));
      t.classList.add('dragging');
    });
    list.addEventListener('dragover', e => {
      if (dragFrom === null) return;
      const t = e.target.closest('.thumb');
      if (!t) return;
      e.preventDefault();
      clearDrop();
      const r = t.getBoundingClientRect();
      t.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
    });
    list.addEventListener('drop', e => {
      const t = e.target.closest('.thumb');
      if (!t || dragFrom === null) return;
      e.preventDefault();
      let ins = +t.dataset.index + (t.classList.contains('drop-after') ? 1 : 0);
      if (ins > dragFrom) ins--;
      const from = dragFrom;
      dragFrom = null;
      clearDrop();
      App.moveSlide(from, ins);
    });
    list.addEventListener('dragend', () => {
      dragFrom = null;
      clearDrop();
      list.querySelectorAll('.dragging').forEach(n => n.classList.remove('dragging'));
    });
  };
})();
