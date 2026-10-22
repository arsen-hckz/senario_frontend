snrInitNav();
function logout() { snrLogout(); }

/* Texts staff edit in the admin dashboard (Concept Text). The HTML holds the
   original wording, so the page still reads right if the API is down. The
   hero stays hidden until the texts arrive (or 2.5 s pass), so visitors
   don't see the old wording swap to the new one. */
function setConceptText(el, text) {
  el.textContent = '';
  String(text).split('\n').forEach(function (line, i) {
    if (i) el.appendChild(document.createElement('br'));
    el.appendChild(document.createTextNode(line));
  });
}

function showConceptHero() {
  if (showConceptHero.done) return;
  showConceptHero.done = true;
  gsap.to('.hero-statement', { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: 0.1 });
}

(async function loadConceptTexts() {
  var timer = setTimeout(showConceptHero, 2500);
  try {
    var res = await fetch(API_BASE + '/content/concept/');
    if (res.ok) {
      var texts = await res.json();
      document.querySelectorAll('[data-text]').forEach(function (el) {
        var value = texts[el.dataset.text];
        if (typeof value === 'string' && value) setConceptText(el, value);
      });
    }
  } catch (ex) { /* keep the built-in wording */ }
  clearTimeout(timer);
  showConceptHero();
})();

/* Photos staff replaced in the admin dashboard. The HTML keeps the original
   photos; an uploaded one (non-null URL) takes its place. */
(async function loadConceptImages() {
  try {
    var res = await fetch(API_BASE + '/content/concept/images/');
    if (!res.ok) return;
    var urls = await res.json();
    document.querySelectorAll('img[data-image]').forEach(function (img) {
      var url = urls[img.dataset.image];
      if (typeof url === 'string' && /^https?:\/\//.test(url)) img.src = url;
    });
  } catch (ex) { /* keep the built-in photos */ }
})();

/* Handlers for this page's data-click / data-change / data-submit
   attributes (see actions.js). */
snrOn('click', 'logout', function (el, event) { logout(); });
