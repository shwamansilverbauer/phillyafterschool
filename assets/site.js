// Small enhancements. Every page reads fine without JavaScript; this adds the
// school search on the home page and the grade/type filter on school pages.
(function () {
  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  // Events for Google Tag Manager. Harmless when GTM is not installed.
  function track(data) { (window.dataLayer = window.dataLayer || []).push(data); }

  // Suggest-a-program form
  var form = document.querySelector('#suggest-form');
  if (form) form.addEventListener('submit', function () {
    track({ event: 'pas_suggest_submit', suggest_kind: form.kind.value, school: form.school.value });
  });

  // ----- home page: find your school -----
  var find = document.querySelector('#find-school');
  if (find) {
    var rows = [].slice.call(document.querySelectorAll('.school'));
    var none = document.querySelector('#no-school');
    find.addEventListener('input', function () {
      var q = find.value.trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (r) {
        var ok = !q || r.getAttribute('data-name').indexOf(q) > -1;
        r.hidden = !ok;
        if (ok) shown++;
      });
      none.hidden = shown > 0;
    });
  }

  // ----- school page: grade and type filter -----
  var page = document.querySelector('[data-school-page]');
  if (!page) return;
  var school = page.getAttribute('data-school-page');
  var grade = 'ALL', rel = 'ALL';
  page.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[data-track]') : null;
    if (!a) return;
    var card = a.closest('.prog');
    track({ event: 'pas_outbound', link_type: a.getAttribute('data-track'), program_id: card ? card.id : '', school: school });
  });
  var groups = [].slice.call(page.querySelectorAll('.group'));
  var gbtns = [].slice.call(page.querySelectorAll('.gbtn'));
  var tbtns = [].slice.call(page.querySelectorAll('.tbtn'));
  var count = page.querySelector('#count');
  var clear = page.querySelector('#clear');

  var saved = store('pas-grade');
  if (saved && gbtns.some(function (b) { return b.getAttribute('data-g') === saved; })) grade = saved;

  function gradeLabel(g) {
    if (g === 'ALL') return 'all grades';
    if (g === 'PK') return 'Pre-K';
    if (g === 'K') return 'kindergarten';
    return 'grade ' + g;
  }

  function apply() {
    var total = 0;
    groups.forEach(function (sec) {
      var n = 0;
      [].slice.call(sec.querySelectorAll('.prog')).forEach(function (card) {
        var gs = card.getAttribute('data-grades');
        var okGrade = grade === 'ALL' || gs === '*' || gs.split(' ').indexOf(grade) > -1;
        var okRel = rel === 'ALL' || card.getAttribute('data-rel') === rel;
        card.hidden = !(okGrade && okRel);
        if (okGrade && okRel) n++;
      });
      sec.hidden = n === 0;
      sec.querySelector('.n').textContent = n;
      total += n;
    });
    count.textContent = total
      ? total + (total === 1 ? ' program' : ' programs') + ' for ' + gradeLabel(grade)
      : 'Nothing for ' + gradeLabel(grade) + ' with this filter. Try another type.';
    clear.hidden = grade === 'ALL' && rel === 'ALL';
    gbtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-g') === grade)); });
    tbtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-t') === rel)); });
  }

  gbtns.forEach(function (b) {
    b.addEventListener('click', function () { grade = b.getAttribute('data-g'); store('pas-grade', grade); apply(); track({ event: 'pas_filter', filter_type: 'grade', filter_value: grade, school: school }); });
  });
  tbtns.forEach(function (b) {
    b.addEventListener('click', function () { rel = b.getAttribute('data-t'); apply(); track({ event: 'pas_filter', filter_type: 'type', filter_value: rel, school: school }); });
  });
  clear.addEventListener('click', function () { grade = 'ALL'; rel = 'ALL'; store('pas-grade', 'ALL'); apply(); });
  apply();
  var pressed = page.querySelector('.gbtn[aria-pressed="true"]');
  if (pressed && pressed.scrollIntoView && grade !== 'ALL') pressed.scrollIntoView({ block: 'nearest', inline: 'center' });
})();
