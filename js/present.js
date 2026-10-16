/* Modo apresentação em tela cheia dentro do editor. */
(function () {
  'use strict';
  const App = window.App;
  const W = App.SLIDE_W, H = App.SLIDE_H;
  const $ = id => document.getElementById(id);
  let idx = 0;
  let wentFullscreen = false;

  App.isPresenting = false;

  App.startPresentation = (from = 0) => {
    App.endEdit();
    App.isPresenting = true;
    idx = Math.max(0, Math.min(from, App.state.slides.length - 1));
    wentFullscreen = false;
    const ov = $('present');
    ov.hidden = false;
    show();
    if (ov.requestFullscreen) ov.requestFullscreen().catch(() => { /* segue sem tela cheia */ });
  };

  function stop() {
    if (!App.isPresenting) return;
    App.isPresenting = false;
    $('present').hidden = true;
    $('present-slide').innerHTML = '';
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    App.state.current = idx;
    App.state.selection = [];
    App.render();
    App.fitStage();
  }

  function show() {
    const s = App.state.slides[idx];
    const ps = $('present-slide');
    ps.style.background = s.background;
    ps.innerHTML = App.slideInnerHTML(s, 'view');
    ps.classList.remove('enter');
    void ps.offsetWidth; // reinicia a animação
    ps.classList.add('enter');
    $('present-counter').textContent = `${idx + 1} / ${App.state.slides.length}`;
    fit();
  }

  function fit() {
    if (!App.isPresenting) return;
    const k = Math.min(innerWidth / W, innerHeight / H);
    const f = $('present-frame');
    f.style.width = W * k + 'px';
    f.style.height = H * k + 'px';
    $('present-slide').style.transform = `scale(${k})`;
  }

  function go(n) {
    n = Math.max(0, Math.min(App.state.slides.length - 1, n));
    if (n === idx) return;
    idx = n;
    show();
  }

  App.initPresent = () => {
    window.addEventListener('keydown', e => {
      if (!App.isPresenting) return;
      const keys = {
        ArrowRight: 1, ArrowDown: 1, PageDown: 1, ' ': 1, Enter: 1,
        ArrowLeft: -1, ArrowUp: -1, PageUp: -1, Backspace: -1,
      };
      if (e.key in keys) go(idx + keys[e.key]);
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(App.state.slides.length - 1);
      else if (e.key === 'Escape') stop();
      else return;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    $('present').addEventListener('click', e => {
      if (e.target.closest('#present-exit')) { stop(); return; }
      const a = e.target.closest('a');
      if (a) {
        const m = (a.getAttribute('href') || '').match(/^#(\d+)$/);
        if (m) { e.preventDefault(); go(+m[1] - 1); }
        return;
      }
      go(idx + 1);
    });
    $('present').addEventListener('contextmenu', e => { e.preventDefault(); go(idx - 1); });

    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement) wentFullscreen = true;
      else if (wentFullscreen && App.isPresenting) stop();
    });
    window.addEventListener('resize', fit);
  };
})();
