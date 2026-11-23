/* ==========================================================================
   화면 렌더링 + 상호작용
   ========================================================================== */
(function () {
  'use strict';

  var D = window.SITE_DATA || {};
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var STAR_PATH = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z';
  var LEVEL_COLOR = { warning: 'c-yellow', hint: 'c-green', error: 'c-pink', note: 'c-blue' };

  /* ---------- 01 traits ---------- */
  function renderTraits() {
    var el = $('#traits-bars');
    if (!el || !D.traits) return;
    el.innerHTML = D.traits.map(function (t) {
      return '<div class="bar">' +
        '<div class="bar__head"><span class="bar__label">' + esc(t.label) + '</span>' +
        '<span class="bar__pct">' + esc(t.pct) + '%</span></div>' +
        '<div class="bar__track" role="presentation"><div class="bar__fill" data-w="' + Number(t.pct) + '%"></div></div>' +
        '</div>';
    }).join('');

    // 화면에 보일 때 막대가 차오르는 효과
    var fills = $$('.bar__fill', el);
    var grow = function () { fills.forEach(function (f) { f.style.width = f.dataset.w; }); };
    if (!('IntersectionObserver' in window)) return grow();
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) { grow(); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(el);
  }

  /* ---------- 02 scenes ---------- */
  function renderScenes() {
    var grid = $('#scenes-grid');
    var tabs = $('#scene-tabs');
    if (!grid || !D.scenes) return;

    grid.innerHTML = D.scenes.map(function (s, i) {
      var stars = [1, 2, 3, 4, 5].map(function (n) {
        return '<button type="button" class="star" data-n="' + n + '" aria-label="별 ' + n + '개">' +
          '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="' + STAR_PATH + '"/></svg></button>';
      }).join('');
      return '<article class="card scene' + (i === 0 ? ' is-active' : '') + '" id="scene-' + i + '" role="tabpanel" aria-labelledby="scene-tab-' + i + '">' +
        '<div class="scene__file">' + esc(s.file) + '</div>' +
        '<div class="scene__body">' +
          '<div><h3 class="scene__title">' + esc(s.title) + '</h3><p class="scene__ja">' + esc(s.ja) + '</p></div>' +
          '<div class="checklist">' + s.items.map(function (it) {
            return '<label class="check"><input type="checkbox"><span>' + esc(it) + '</span></label>';
          }).join('') + '</div>' +
          '<p class="tip"><span class="tip__label"># 선배 tip</span><br>' + esc(s.tip) + '</p>' +
          '<div class="rating"><span class="rating__q">도움이 됐나요?</span><div class="stars">' + stars + '</div></div>' +
        '</div></article>';
    }).join('');

    if (tabs) {
      tabs.innerHTML = D.scenes.map(function (s, i) {
        return '<button type="button" role="tab" class="scene-tab" id="scene-tab-' + i + '" aria-controls="scene-' + i + '" aria-selected="' + (i === 0) + '">' + esc(s.tab) + '</button>';
      }).join('');
      tabs.addEventListener('click', function (e) {
        var btn = e.target.closest('.scene-tab');
        if (!btn) return;
        $$('.scene-tab', tabs).forEach(function (b) { b.setAttribute('aria-selected', String(b === btn)); });
        $$('.scene', grid).forEach(function (a) { a.classList.toggle('is-active', a.id === btn.getAttribute('aria-controls')); });
      });
    }

    // 별점: 마우스 오버 미리보기 + 클릭 고정
    $$('.stars', grid).forEach(function (wrap) {
      var stars = $$('.star', wrap);
      var picked = 0;
      var paint = function (n) { stars.forEach(function (s, i) { s.classList.toggle('is-on', i < n); }); };
      wrap.addEventListener('mouseover', function (e) { var s = e.target.closest('.star'); if (s) paint(+s.dataset.n); });
      wrap.addEventListener('mouseleave', function () { paint(picked); });
      wrap.addEventListener('click', function (e) {
        var s = e.target.closest('.star'); if (!s) return;
        picked = +s.dataset.n; paint(picked);
        stars.forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.n === picked)); });
      });
    });
  }

  /* ---------- 주의사항 ---------- */
  function renderWarnings() {
    var el = $('#diagnostics');
    if (!el || !D.warnings) return;
    el.innerHTML = D.warnings.map(function (w) {
      return '<div><span class="diag__code ' + (LEVEL_COLOR[w.level] || '') + '">' + esc(w.level) +
        '<span class="diag__id">[' + esc(w.id) + ']</span></span>: <strong>' + esc(w.title) + '</strong><br>' +
        '<span class="diag__arrow">  --&gt;</span> <span class="diag__msg">' + esc(w.msg) + '</span></div>';
    }).join('');
  }

  /* ---------- 03 smalltalk ---------- */
  function renderTalk() {
    var el = $('#talk-grid');
    if (!el || !D.talk) return;
    el.innerHTML = D.talk.map(function (k) {
      return '<article class="talk"><span class="talk__key">' + esc(k.key) + ':</span>' +
        '<h3 class="talk__title">' + esc(k.title) + '</h3><p class="talk__body">' + esc(k.body) + '</p></article>';
    }).join('');
  }

  /* ---------- 04 dict 미리보기 (홈) ---------- */
  function renderDictPreview() {
    var el = $('#dict-preview');
    if (!el || !D.dict) return;
    el.innerHTML = D.dict.filter(function (d) { return d.preview; }).map(function (d) {
      return '<div><span class="c-green">"' + esc(d.term) + '"</span> <span class="c-comment">→</span> ' +
        esc(d.ko) + ' <span class="c-comment">/ ' + esc(d.ja) + '</span></div>';
    }).join('');
  }

  /* ---------- 05 thread ---------- */
  function renderThread() {
    var el = $('#bbs-roll');
    if (!el || !D.posts) return;
    var ids = ['a3Kf9x', 'Qz81Lp', 'M0wY2e', 'bT7nRc', 'Xe4Hk1', 'p9DuVs', 'J2rqWm', 'L6aZtN'];
    var days = ['木', '金', '土'];
    var html = D.posts.map(function (p, i) {
      var date = '2026/11/' + (13 + (i % 3)) + '(' + days[i % 3] + ') ' + (14 + (i % 9)) + ':' + String((i * 7) % 60).padStart(2, '0');
      return '<div class="post"><div class="post__meta">' + (i + 1) + ' ：<span class="post__name">익명의 글시융러</span>' +
        '<span class="post__date">：' + date + '</span> ID:' + ids[i % ids.length] + '</div>' +
        '<div class="post__body">' + (p.anchor ? '<span class="post__anchor">' + esc(p.anchor) + '</span>' : '') + esc(p.body) + '</div></div>';
    }).join('');
    // 끊김 없는 무한 스크롤을 위해 두 번 반복 (두 번째는 스크린리더에서 숨김)
    el.innerHTML = html + '<div aria-hidden="true">' + html + '</div>';

    var form = $('#bbs-form');
    if (form) form.addEventListener('submit', function (e) { e.preventDefault(); });
  }

  /* ---------- 사전 페이지 ---------- */
  function renderDictPage() {
    var list = $('#dict-entries');
    var filters = $('#dict-filters');
    var count = $('#dict-count');
    if (!list || !D.dict) return;
    var TAGS = ['전체', '사투리', '말버릇', '외래어', '추정'];
    var current = '전체';

    function draw() {
      var rows = current === '전체' ? D.dict : D.dict.filter(function (d) { return d.tag === current; });
      list.innerHTML = rows.map(function (e) {
        return '<article class="card entry">' +
          '<div class="entry__top"><h2 class="entry__term">' + esc(e.term) + '</h2><span class="entry__tag">@' + esc(e.tag) + '</span></div>' +
          '<dl><div><dt>ko</dt><dd class="ko">' + esc(e.ko) + '</dd></div><div><dt>ja</dt><dd class="ja">' + esc(e.ja) + '</dd></div></dl>' +
          '<p class="tip"><span class="tip__label"># tip </span>' + esc(e.tip) + '</p></article>';
      }).join('');
      if (count) count.textContent = rows.length + ' entries';
      $$('.filter', filters).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tag === current)); });
    }

    if (filters) {
      filters.innerHTML = TAGS.map(function (t) {
        return '<button type="button" class="filter" data-tag="' + t + '">' + (t === '전체' ? '*' : '@' + t) + '</button>';
      }).join('');
      filters.addEventListener('click', function (e) {
        var b = e.target.closest('.filter'); if (!b) return;
        current = b.dataset.tag; draw();
      });
    }
    draw();
  }

  /* ---------- 공통 상호작용 ---------- */
  function bindUI() {
    // 모바일 햄버거 메뉴
    var toggle = $('#menu-toggle');
    var nav = $('#main-nav');
    if (toggle && nav) {
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      nav.addEventListener('click', function (e) {
        if (e.target.closest('a')) { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded', 'false'); }
      });
    }

    // KO / JA 토글 (현재는 상태 표시만)
    var langBtns = $$('[data-lang]');
    var mLang = $('#m-lang');
    function setLang(lang) {
      langBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
      if (mLang) mLang.textContent = lang === 'ko' ? 'KO/ja' : 'ko/JA';
      document.documentElement.lang = lang;
    }
    langBtns.forEach(function (b) { b.addEventListener('click', function () { setLang(b.dataset.lang); }); });
    if (mLang) mLang.addEventListener('click', function () { setLang(document.documentElement.lang === 'ko' ? 'ja' : 'ko'); });

    // 오늘 분위기 투표
    var moods = $$('.mood-btn');
    moods.forEach(function (b) {
      b.addEventListener('click', function () {
        moods.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      });
    });

    // 검색창 (기능 연결 전)
    $$('form[role="search"]').forEach(function (f) { f.addEventListener('submit', function (e) { e.preventDefault(); }); });

    // 스크롤 위치에 따라 상단 메뉴 활성화
    var links = $$('#main-nav a[href^="#"]');
    var targets = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    if (links.length && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (a, i) {
            if (targets[i] === en.target) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
          });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      targets.forEach(function (t) { if (t) io.observe(t); });
    }
  }

  renderTraits();
  renderScenes();
  renderWarnings();
  renderTalk();
  renderDictPreview();
  renderThread();
  renderDictPage();
  bindUI();
})();
