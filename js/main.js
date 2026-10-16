/* Inicialização, ações da barra de ferramentas e conteúdo de exemplo. */
(function () {
  'use strict';
  const App = window.App;
  const $ = id => document.getElementById(id);

  App.actions = {
    text: () => App.addElement('text'),
    rect: () => App.addElement('rect'),
    ellipse: () => App.addElement('ellipse'),
    triangle: () => App.addElement('triangle'),
    line: () => App.addElement('line'),
    button: () => App.addElement('button'),
    undo: () => App.undo(),
    redo: () => App.redo(),
    duplicate: () => App.duplicateSelected(),
    delete: () => App.deleteSelected(),
    'add-slide': () => App.addSlide(),
    present: () => App.startPresentation(App.state.current),
    export: () => App.exportHTML(),
    open: () => {
      if (App.dirty && !confirm('Há alterações não exportadas. Abrir outro arquivo mesmo assim?')) return;
      $('open-file').click();
    },
  };

  App.updateToolbar = () => {
    const n = App.state.selection.length;
    const q = a => document.querySelector(`#toolbar [data-action="${a}"]`);
    q('undo').disabled = !App.canUndo();
    q('redo').disabled = !App.canRedo();
    q('duplicate').disabled = !n;
    q('delete').disabled = !n;
    $('align-toggle').disabled = !n;
    const menu = $('align-menu');
    if (!n) menu.hidden = true;
    if (!menu.hidden) menu.innerHTML = App.alignPanelHTML(n);
  };

  function demoSlides() {
    const s1 = App.newSlide(false);
    s1.elements = [
      App.make('rect', { x: 580, y: 206, w: 120, h: 8, z: 1 }, { radius: 4 }),
      App.make('text', { x: 140, y: 236, w: 1000, h: 96, z: 2, html: '<b>Minha apresentação</b>' }, { fontSize: 64, align: 'center' }),
      App.make('text', { x: 240, y: 340, w: 800, h: 50, z: 3, html: 'Subtítulo ou nome do apresentador' }, { fontSize: 26, color: '#6b7280', align: 'center' }),
      App.make('button', { x: 540, y: 440, w: 200, h: 56, z: 4, html: 'Começar →', link: '#2' }),
    ];
    const s2 = App.newSlide(false);
    s2.elements = [
      App.make('ellipse', { x: 860, y: 190, w: 320, h: 320, z: 1 }, { fill: '#e8eefe' }),
      App.make('text', { x: 80, y: 60, w: 1120, h: 80, z: 2, html: '<b>Tópico 1</b>' }, { fontSize: 48 }),
      App.make('text', { x: 80, y: 180, w: 700, h: 200, z: 3, html: '<ul><li>Primeiro ponto</li><li>Segundo ponto</li><li>Terceiro ponto</li></ul>' }, { fontSize: 30 }),
    ];
    return [s1, s2];
  }

  function init() {
    const style = document.createElement('style');
    style.textContent = App.ELEMENT_CSS;
    document.head.prepend(style);

    App.state.slides = demoSlides();
    App.resetHistory();

    App.initInteractions();
    App.initTextEdit();
    App.initProps();
    App.initSlides();
    App.initPresent();

    document.addEventListener('click', e => {
      const b = e.target.closest('#toolbar [data-action], #add-slide');
      if (b && !b.disabled) App.actions[b.dataset.action]();
    });

    const title = $('deck-title');
    title.value = App.state.title;
    title.addEventListener('input', () => { App.state.title = title.value; App.dirty = true; });
    title.addEventListener('keydown', e => { if (e.key === 'Enter') title.blur(); });

    // Menu "Alinhar" da toolbar
    const menu = $('align-menu');
    $('align-toggle').addEventListener('click', () => {
      menu.hidden = !menu.hidden;
      App.updateToolbar();
    });
    menu.addEventListener('click', e => App.handleAlignClick(e));
    menu.addEventListener('change', e => {
      if (e.target.matches('[data-align-slide]')) { App.alignToSlide = e.target.checked; App.renderProps(); }
    });
    document.addEventListener('pointerdown', e => {
      if (!e.target.closest('.dropdown')) menu.hidden = true;
    });

    $('open-file').addEventListener('change', e => {
      if (e.target.files[0]) App.openFile(e.target.files[0]);
      e.target.value = '';
    });

    window.addEventListener('beforeunload', e => {
      if (App.dirty) { e.preventDefault(); e.returnValue = ''; }
    });

    new ResizeObserver(App.fitStage).observe($('stage'));
    App.render();
    App.fitStage();
  }

  init();
})();
