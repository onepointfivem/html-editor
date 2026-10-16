/* Exporta a apresentação como um único arquivo HTML e reabre arquivos exportados para edição. */
(function () {
  'use strict';
  const App = window.App;
  const esc = App.esc;

  /* Player embutido no HTML exportado (serializado via toString) */
  function player() {
    var W = 1280, H = 720;
    var slides = document.querySelectorAll('.slide');
    var frame = document.getElementById('frame');
    var counter = document.getElementById('counter');
    var i = 0;
    function fit() {
      var k = Math.min(innerWidth / W, innerHeight / H);
      frame.style.width = W * k + 'px';
      frame.style.height = H * k + 'px';
      for (var j = 0; j < slides.length; j++) slides[j].style.transform = 'scale(' + k + ')';
    }
    function go(n) {
      n = Math.max(0, Math.min(slides.length - 1, n));
      slides[i].classList.remove('active');
      i = n;
      slides[i].classList.add('active');
      counter.textContent = (i + 1) + ' / ' + slides.length;
      history.replaceState(null, '', '#' + (i + 1));
    }
    addEventListener('resize', fit);
    addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'Enter') go(i + 1);
      else if (k === 'ArrowLeft' || k === 'ArrowUp' || k === 'PageUp' || k === 'Backspace') go(i - 1);
      else if (k === 'Home') go(0);
      else if (k === 'End') go(slides.length - 1);
      else if (k === 'f' || k === 'F') {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
      } else return;
      e.preventDefault();
    });
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (a) {
        var m = (a.getAttribute('href') || '').match(/^#(\d+)$/);
        if (m) { e.preventDefault(); go(m[1] - 1); }
        return;
      }
      go(i + 1);
    });
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); go(i - 1); });
    var h = location.hash.match(/^#(\d+)$/);
    fit();
    go(h ? h[1] - 1 : 0);
  }

  App.buildExportHTML = () => {
    const title = App.state.title || 'Apresentação';
    const data = JSON.stringify({ app: 'html-slides', version: 1, title, slides: App.state.slides }).replace(/</g, '\\u003c');
    const sections = App.state.slides
      .map(s => `<section class="slide" style="background:${esc(s.background)}">${App.slideInnerHTML(s, 'view')}</section>`)
      .join('\n');
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${App.ELEMENT_CSS}
html,body{margin:0;height:100%;background:#000;overflow:hidden;}
#deck{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;}
#frame{position:relative;overflow:hidden;}
.slide{position:absolute;left:0;top:0;transform-origin:0 0;overflow:hidden;display:none;}
.slide.active{display:block;animation:fade .35s ease;}
@keyframes fade{from{opacity:0}to{opacity:1}}
#counter{position:fixed;right:16px;bottom:12px;color:#fff;font:12px system-ui,sans-serif;opacity:.45;}
</style>
</head>
<body>
<div id="deck"><div id="frame">
${sections}
</div></div>
<div id="counter"></div>
<script type="application/json" id="deck-data">${data}</script>
<script>(${player.toString()})();</script>
</body>
</html>`;
  };

  App.exportHTML = () => {
    App.endEdit();
    const blob = new Blob([App.buildExportHTML()], { type: 'text/html' });
    const name = (App.state.title || 'apresentacao')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'apresentacao';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name + '.html';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    App.dirty = false;
  };

  App.openFile = file => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const doc = new DOMParser().parseFromString(String(reader.result), 'text/html');
        const data = JSON.parse(doc.getElementById('deck-data').textContent);
        if (!Array.isArray(data.slides) || !data.slides.length) throw new Error('vazio');
        data.slides.forEach(s => s.elements.forEach(e => { e.html = App.sanitize(e.html); }));
        App.state.slides = data.slides;
        App.state.title = data.title || 'Apresentação';
        App.state.current = 0;
        App.state.selection = [];
        document.getElementById('deck-title').value = App.state.title;
        App.resetHistory();
        App.render();
      } catch (_) {
        alert('Este arquivo não é uma apresentação exportada por este editor.');
      }
    };
    reader.readAsText(file);
  };
})();
