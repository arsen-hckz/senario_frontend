/* Grid tiles load the small version (`thumb`, ~1000px); the full photo
   (`src`) only loads when one is opened in the lightbox. */
function moodImg(p) {
  return '<img src="' + escHtml(p.thumb || p.src) + '" data-full="' + escHtml(p.src) + '"' +
         ' alt="Σenario" loading="lazy" decoding="async">';
}

function renderDesktopGrid(photos) {
  var el = document.getElementById('photoGrid');
  if (!photos.length) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = photos.map(function (p) {
    return '<div class="grid-cell" data-caption="' + escHtml(p.title) + '">' +
             '<div class="grid-caption">' +
               '<span class="grid-caption__title">' + escHtml(p.title) + '</span>' +
               '<span class="grid-caption__body">' + escHtml(p.body).replace(/\n/g, '<br>') + '</span>' +
             '</div>' +
             moodImg(p) +
           '</div>';
  }).join('');
}

function renderMobileSlides(photos) {
  var el = document.getElementById('moodSlides');
  if (!photos.length) {
    el.innerHTML = '';
    return;
  }
  var html = '';
  for (var i = 0; i < photos.length; i += 4) {
    var group = photos.slice(i, i + 4);
    var cap = group[0];
    var captionHtml =
      '<div class="mood-slide__caption mood-slide__caption--' + (group.length === 4 ? 'overlay' : 'cell') + '">' +
        '<span class="mood-slide__title">' + escHtml(cap.title) + '</span>' +
        '<span class="mood-slide__body">' + escHtml(cap.body).replace(/\n/g, '<br>') + '</span>' +
      '</div>';

    var photoDivs = group.map(function (p) {
      return '<div class="mood-slide__photo">' + moodImg(p) + '</div>';
    });

    var slideInner;
    if (group.length === 4) {
      /* caption sits between photo 2 and 3 so the CSS nth-of-type
         placement rules land the 4 photos in the 4 quadrants correctly */
      slideInner = photoDivs[0] + photoDivs[1] + captionHtml + photoDivs[2] + photoDivs[3];
    } else {
      slideInner = photoDivs.join('') + captionHtml;
    }
    html += '<div class="mood-slide">' + slideInner + '</div>';
  }
  el.innerHTML = html;
  renderMoodDots();
}

function renderMoodDots() {
  var slides = document.getElementById('moodSlides');
  var dots = document.getElementById('moodDots');
  var count = slides.children.length;
  dots.innerHTML = '';
  if (count < 2) return;

  for (var i = 0; i < count; i++) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', 'Page ' + (i + 1) + ' of ' + count);
    b.addEventListener('click', (function (index) {
      return function () {
        slides.scrollTo({ left: index * slides.clientWidth, behavior: 'smooth' });
      };
    })(i));
    dots.appendChild(b);
  }

  function update() {
    var current = Math.round(slides.scrollLeft / Math.max(slides.clientWidth, 1));
    Array.prototype.forEach.call(dots.children, function (d, j) {
      d.classList.toggle('active', j === current);
      d.setAttribute('aria-selected', j === current ? 'true' : 'false');
    });
  }

  if (!slides.dataset.dotsWired) {
    var ticking = false;
    slides.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; update(); });
    }, { passive: true });
    window.addEventListener('resize', update);
    slides.dataset.dotsWired = '1';
  }
  update();
}

(async function initMoodboard() {
  var photos = await getMoodboardPhotos();
  renderDesktopGrid(photos);
  renderMobileSlides(photos);
  animateGridCells();
  window.wireLightboxImages();
  ScrollTrigger.refresh();
})();

/* Handlers for this page's data-click / data-change / data-submit
   attributes (see actions.js). */
snrOn('click', 'logout', function (el, event) { logout(); });
