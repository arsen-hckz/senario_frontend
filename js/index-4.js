(function () {
  var lb        = document.getElementById('lightbox');
  var lbImg     = document.getElementById('lbImg');
  var lbCaption = document.getElementById('lbCaption');
  var lbStage   = document.getElementById('lbStage');
  var lbScale   = document.getElementById('lbScale');
  var lbClose   = document.getElementById('lbClose');
  var lbZoomIn  = document.getElementById('lbZoomIn');
  var lbZoomOut = document.getElementById('lbZoomOut');
  var lbReset   = document.getElementById('lbReset');

  var state = { scale: 1, rot: 0, tx: 0, ty: 0 };
  var MIN_SCALE = 0.5, MAX_SCALE = 8;

  function applyTransform(animated) {
    if (!animated) lbImg.classList.add('lb-instant');
    else           lbImg.classList.remove('lb-instant');
    lbImg.style.transform =
      'translate(' + state.tx + 'px,' + state.ty + 'px)' +
      ' scale(' + state.scale + ')' +
      ' rotate(' + state.rot + 'deg)';
    lbScale.textContent = Math.round(state.scale * 100) + '%';
  }

  function clampScale(s) {
    return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
  }

  function openLightbox(src, caption) {
    state = { scale: 1, rot: 0, tx: 0, ty: 0 };
    lbImg.src = src;
    lbCaption.textContent = caption || '';
    lbImg.classList.add('lb-instant');
    applyTransform(false);
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lb.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(function () { lbImg.src = ''; }, 300);
  }

  /* open on photo click — called after each render, since grid/slide
     images are (re)created from moodboard data rather than static markup */
  window.wireLightboxImages = function () {
    document.querySelectorAll('.grid-cell img, .mood-slide__photo img').forEach(function (img) {
      img.addEventListener('click', function (e) {
        e.stopPropagation();
        var cell = img.closest('.grid-cell');
        var caption = cell ? (cell.dataset.caption || '') : '';
        openLightbox(img.dataset.full || img.src, caption);
      });
    });
  };

  lbClose.addEventListener('click', closeLightbox);
  lb.addEventListener('click', function (e) {
    if (e.target === lb || e.target === lbStage) closeLightbox();
  });

  /* zoom buttons */
  lbZoomIn.addEventListener('click',  function () { state.scale = clampScale(state.scale * 1.25); applyTransform(true); });
  lbZoomOut.addEventListener('click', function () { state.scale = clampScale(state.scale / 1.25); applyTransform(true); });

  /* rotate buttons — sides */
  document.getElementById('lbRotSideL').addEventListener('click', function () { state.rot -= 90; applyTransform(true); });
  document.getElementById('lbRotSideR').addEventListener('click', function () { state.rot += 90; applyTransform(true); });

  /* reset */
  lbReset.addEventListener('click', function () {
    state = { scale: 1, rot: 0, tx: 0, ty: 0 };
    applyTransform(true);
  });

  /* scroll to zoom toward cursor */
  lbStage.addEventListener('wheel', function (e) {
    e.preventDefault();
    var rect  = lbStage.getBoundingClientRect();
    var cx    = rect.left + rect.width  / 2;
    var cy    = rect.top  + rect.height / 2;
    var mx    = e.clientX - cx;
    var my    = e.clientY - cy;
    var delta = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    var ns    = clampScale(state.scale * delta);
    var ratio = ns / state.scale;
    state.tx  = mx + (state.tx - mx) * ratio;
    state.ty  = my + (state.ty - my) * ratio;
    state.scale = ns;
    lbImg.classList.add('lb-instant');
    applyTransform(false);
  }, { passive: false });

  /* drag to pan */
  var drag = { active: false, sx: 0, sy: 0, ox: 0, oy: 0 };
  lbStage.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return;
    drag.active = true;
    drag.sx = e.clientX; drag.sy = e.clientY;
    drag.ox = state.tx;  drag.oy = state.ty;
    lbStage.classList.add('grabbing');
  });
  window.addEventListener('mousemove', function (e) {
    if (!drag.active) return;
    state.tx = drag.ox + (e.clientX - drag.sx);
    state.ty = drag.oy + (e.clientY - drag.sy);
    lbImg.classList.add('lb-instant');
    applyTransform(false);
  });
  window.addEventListener('mouseup', function () {
    drag.active = false;
    lbStage.classList.remove('grabbing');
  });

  /* touch drag + pinch */
  var touch = { lastDist: 0, sx: 0, sy: 0, ox: 0, oy: 0, panning: false };
  lbStage.addEventListener('touchstart', function (e) {
    if (e.touches.length === 1) {
      touch.panning = true;
      touch.sx = e.touches[0].clientX; touch.sy = e.touches[0].clientY;
      touch.ox = state.tx; touch.oy = state.ty;
      touch.lastDist = 0;
    } else if (e.touches.length === 2) {
      touch.panning = false;
      touch.lastDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });
  lbStage.addEventListener('touchmove', function (e) {
    e.preventDefault();
    if (e.touches.length === 1 && touch.panning) {
      state.tx = touch.ox + (e.touches[0].clientX - touch.sx);
      state.ty = touch.oy + (e.touches[0].clientY - touch.sy);
      lbImg.classList.add('lb-instant');
      applyTransform(false);
    } else if (e.touches.length === 2) {
      var dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (touch.lastDist > 0) {
        state.scale = clampScale(state.scale * (dist / touch.lastDist));
        lbImg.classList.add('lb-instant');
        applyTransform(false);
      }
      touch.lastDist = dist;
    }
  }, { passive: false });
  lbStage.addEventListener('touchend', function () {
    touch.panning = false; touch.lastDist = 0;
  });

  /* keyboard */
  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('open')) return;
    switch (e.key) {
      case 'Escape': closeLightbox(); break;
      case '+': case '=': state.scale = clampScale(state.scale * 1.25); applyTransform(true); break;
      case '-': state.scale = clampScale(state.scale / 1.25); applyTransform(true); break;
      case 'q': case 'Q': state.rot -= 90; applyTransform(true); break;
      case 'e': case 'E': state.rot += 90; applyTransform(true); break;
      case '0': state = { scale:1, rot:0, tx:0, ty:0 }; applyTransform(true); break;
    }
  });
})();
