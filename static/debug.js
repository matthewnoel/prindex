/* Prindex Design Lab — TEMPORARY debug widget for trying theme
   explorations on the live site. Activate with ?debug=1 (or #debug) on
   any page; the widget then persists across pages via localStorage
   until you press "Exit design lab". Normal visitors never see it.
   To end the experiment: delete this file, static/themes.css, and
   their references in scripts/build.mjs. */
(function () {
  'use strict';

  var THEMES = [
    {
      id: '',
      name: 'Current',
      blurb: 'The site as it ships today. Follows your system light/dark setting.',
    },
    {
      id: 'workshop',
      name: 'Workshop',
      blurb: 'Engineering blueprint: graph paper, navy ink, safety orange, mono labels.',
    },
    {
      id: 'showcase',
      name: 'Showcase',
      blurb: 'Dark gallery: big gradient type, glowing cards that lift on hover.',
    },
    {
      id: 'fieldnotes',
      name: 'Field Notes',
      blurb: 'Warm paper catalog: serif type, editorial hairlines, terracotta accent.',
    },
    {
      id: 'hyper',
      name: 'Hyper',
      blurb: 'Bold maker energy: chunky borders, offset shadows, loud accents.',
    },
  ];

  var LS_ACTIVE = 'prindex-debug';
  var LS_THEME = 'prindex-theme';

  function lsGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function lsSet(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) {
      /* private mode etc. — widget still works for this page */
    }
  }

  if (/[?&#]debug\b/.test(location.search + location.hash)) {
    lsSet(LS_ACTIVE, '1');
  }
  if (lsGet(LS_ACTIVE) !== '1') return;

  function applyTheme(id) {
    if (id) document.documentElement.setAttribute('data-theme', id);
    else document.documentElement.removeAttribute('data-theme');
    lsSet(LS_THEME, id || null);
  }

  var css = [
    '#prindex-lab { position: fixed; right: 16px; bottom: 16px; z-index: 99999;',
    '  font: 13px/1.45 system-ui, sans-serif; color: #e6edf3; }',
    '#prindex-lab * { box-sizing: border-box; margin: 0; }',
    '#prindex-lab .lab-panel { width: 272px; background: rgba(22, 27, 34, 0.96);',
    '  border: 1px solid #3d444d; border-radius: 12px; padding: 14px;',
    '  box-shadow: 0 12px 32px rgba(0,0,0,0.4); backdrop-filter: blur(4px); }',
    '#prindex-lab .lab-head { display: flex; align-items: center; justify-content: space-between;',
    '  margin-bottom: 10px; }',
    '#prindex-lab .lab-title { font-weight: 700; font-size: 13px; letter-spacing: 0.02em; }',
    '#prindex-lab .lab-min { background: none; border: none; color: #9aa4ae; cursor: pointer;',
    '  font-size: 16px; padding: 0 2px; line-height: 1; }',
    '#prindex-lab .lab-min:hover { color: #e6edf3; }',
    '#prindex-lab label { display: block; padding: 7px 9px; border-radius: 8px; cursor: pointer;',
    '  border: 1px solid transparent; }',
    '#prindex-lab label:hover { background: rgba(255,255,255,0.06); }',
    '#prindex-lab label.on { background: rgba(83,155,245,0.12); border-color: rgba(83,155,245,0.45); }',
    '#prindex-lab label b { display: block; font-size: 13px; }',
    '#prindex-lab label small { color: #9aa4ae; font-size: 11.5px; display: block; margin-top: 1px; }',
    '#prindex-lab input { position: absolute; opacity: 0; pointer-events: none; }',
    '#prindex-lab .lab-exit { margin-top: 10px; width: 100%; background: none; cursor: pointer;',
    '  border: 1px solid #3d444d; border-radius: 8px; color: #9aa4ae; padding: 6px; font: inherit; }',
    '#prindex-lab .lab-exit:hover { color: #ff7b72; border-color: #ff7b72; }',
    '#prindex-lab .lab-fab { display: none; width: 44px; height: 44px; border-radius: 50%;',
    '  border: 1px solid #3d444d; background: rgba(22, 27, 34, 0.96); cursor: pointer;',
    '  font-size: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }',
    '#prindex-lab.min .lab-panel { display: none; }',
    '#prindex-lab.min .lab-fab { display: block; }',
  ].join('\n');

  function build() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var root = document.createElement('div');
    root.id = 'prindex-lab';

    var panel = document.createElement('div');
    panel.className = 'lab-panel';

    var head = document.createElement('div');
    head.className = 'lab-head';
    var title = document.createElement('span');
    title.className = 'lab-title';
    title.textContent = '🎨 Design Lab';
    var minBtn = document.createElement('button');
    minBtn.className = 'lab-min';
    minBtn.title = 'Minimize';
    minBtn.textContent = '–';
    minBtn.addEventListener('click', function () {
      root.classList.add('min');
    });
    head.appendChild(title);
    head.appendChild(minBtn);
    panel.appendChild(head);

    var current = lsGet(LS_THEME) || '';
    var labels = [];

    THEMES.forEach(function (theme) {
      var label = document.createElement('label');
      if (theme.id === current) label.className = 'on';
      var input = document.createElement('input');
      input.type = 'radio';
      input.name = 'prindex-theme';
      input.checked = theme.id === current;
      input.addEventListener('change', function () {
        applyTheme(theme.id);
        labels.forEach(function (l) {
          l.className = '';
        });
        label.className = 'on';
      });
      var name = document.createElement('b');
      name.textContent = theme.name;
      var blurb = document.createElement('small');
      blurb.textContent = theme.blurb;
      label.appendChild(input);
      label.appendChild(name);
      label.appendChild(blurb);
      labels.push(label);
      panel.appendChild(label);
    });

    var exit = document.createElement('button');
    exit.className = 'lab-exit';
    exit.textContent = 'Exit design lab';
    exit.title = 'Reset to the current design and hide this widget (re-open with ?debug=1)';
    exit.addEventListener('click', function () {
      applyTheme('');
      lsSet(LS_ACTIVE, null);
      root.remove();
    });
    panel.appendChild(exit);

    var fab = document.createElement('button');
    fab.className = 'lab-fab';
    fab.title = 'Open Design Lab';
    fab.textContent = '🎨';
    fab.addEventListener('click', function () {
      root.classList.remove('min');
    });

    root.appendChild(panel);
    root.appendChild(fab);
    document.body.appendChild(root);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build);
  } else {
    build();
  }
})();
