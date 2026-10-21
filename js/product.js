snrInitNav();
function logout() { snrLogout(); }

var slug = new URLSearchParams(window.location.search).get('slug');

function initGallery(p) {
  var urls = (p.images || []).map(function(img) { return img.image; });
  if (!urls.length) urls = [p.image || 'logo_mark_transparent_orange.png'];

  var main   = document.getElementById('prod-img');
  var prev   = document.getElementById('galleryPrev');
  var next   = document.getElementById('galleryNext');
  var thumbs = document.getElementById('galleryThumbs');
  var current = 0;

  function show(i) {
    current = (i + urls.length) % urls.length;
    main.src = urls[current];
    main.alt = p.name + (urls.length > 1 ? ' — photo ' + (current + 1) + ' of ' + urls.length : '');
    Array.prototype.forEach.call(thumbs.children, function(t, j) {
      t.classList.toggle('active', j === current);
    });
  }

  if (urls.length > 1) {
    urls.forEach(function(url, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Show photo ' + (i + 1));
      var img = document.createElement('img');
      img.src = url;
      img.alt = '';
      img.loading = 'lazy';
      b.appendChild(img);
      b.addEventListener('click', function() { show(i); });
      thumbs.appendChild(b);
    });
    prev.hidden = next.hidden = thumbs.hidden = false;
    document.getElementById('gallery').classList.add('has-thumbs');
    prev.addEventListener('click', function() { show(current - 1); });
    next.addEventListener('click', function() { show(current + 1); });

    document.addEventListener('keydown', function(e) {
      if (e.target.closest && e.target.closest('input, textarea, select')) return;
      if (e.key === 'ArrowLeft')  show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });

    // Swipe on phones
    var startX = null;
    var gallery = document.getElementById('gallery');
    gallery.addEventListener('touchstart', function(e) { startX = e.touches[0].clientX; }, {passive: true});
    gallery.addEventListener('touchend', function(e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
      startX = null;
    });
  }
  show(0);
}

async function loadProduct() {
  if (!slug) {
    document.getElementById('prod-name').textContent = 'Product not found.';
    return;
  }
  try {
    var res = await fetch(API_BASE + '/products/' + slug + '/');
    if (!res.ok) throw new Error();
    var p = await res.json();

    document.getElementById('bc-name').textContent    = p.name;
    document.getElementById('prod-name').textContent  = p.name;
    document.getElementById('prod-price').textContent = '' + formatEuro(parseFloat(p.effective_price || p.price));
    initGallery(p);
    document.getElementById('prod-desc').textContent  = p.description || '';
    document.title = p.name + ' — Σenario';

    var sizeGrid = document.getElementById('size-grid');
    var variants = p.variants || [];
    if (!variants.length) {
      // One-size product: no empty "Size" heading.
      document.getElementById('size-label').style.display = 'none';
      sizeGrid.style.display = 'none';
    }
    // Pre-select the first size that's in stock (sold-out ones come first sometimes).
    var firstInStock = variants.findIndex(function(v) { return v.stock > 0; });
    variants.forEach(function(v, i) {
      var btn = document.createElement('button');
      btn.className = 'size-btn' + (i === firstInStock ? ' selected' : '');
      btn.textContent = v.size;
      btn.dataset.variantId = v.id;
      if (v.stock === 0) { btn.classList.add('disabled'); btn.disabled = true; }
      btn.addEventListener('click', function() {
        if (btn.disabled) return;
        sizeGrid.querySelectorAll('.size-btn').forEach(function(b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
      });
      sizeGrid.appendChild(btn);
    });

    var qty = 1;
    var qtyValue = document.getElementById('qty-value');
    var qtyMinus = document.getElementById('qty-minus');
    var qtyPlus  = document.getElementById('qty-plus');

    function renderQty() {
      qtyValue.textContent = qty;
      qtyMinus.disabled = qty <= 1;
    }
    qtyMinus.addEventListener('click', function() {
      if (qty > 1) { qty--; renderQty(); }
    });
    qtyPlus.addEventListener('click', function() {
      qty++; renderQty();
    });
    renderQty();

    /* Adds the selected size and quantity to the cart. Returns true when added;
       otherwise shows why on `btn` for a moment and returns false. */
    async function addSelected(btn, label) {
      var sel = sizeGrid.querySelector('.size-btn.selected');
      var variantId = sel ? sel.dataset.variantId : null;
      clearTimeout(btn._t);
      if (variants.length && !variantId) {
        btn.textContent = 'Choose a size';
        btn._t = setTimeout(function() { btn.textContent = label; }, 2000);
        return false;
      }
      btn.textContent = '...';
      btn.disabled = true;
      // Signed in or not: guests get a cart in the browser (see api.js).
      var error = await snrCartAdd(p.id, variantId, qty);
      if (error) {
        // e.g. "Only 2 left in stock." Shown on the button briefly.
        btn.textContent = error;
        btn.disabled = false;
        btn._t = setTimeout(function() { btn.textContent = label; }, 2500);
        return false;
      }
      return true;
    }

    // Adds the selection to the cart and goes straight to checkout.
    document.querySelector('.btn-buy-now').addEventListener('click', async function() {
      if (await addSelected(this, 'Buy it Now')) window.location.href = 'checkout';
    });

    document.querySelector('.btn-atc').addEventListener('click', async function() {
      var self = this;
      if (await addSelected(self, 'Add to Cart')) {
        self.textContent = '✓ Added to Cart';
        self.classList.add('added');
        qty = 1;
        renderQty();
        snrUpdateCartBadge();
        self._t = setTimeout(function() {
          self.textContent = 'Add to Cart';
          self.classList.remove('added');
          self.disabled = false;
        }, 2000);
      }
    });

  } catch (ex) {
    document.getElementById('prod-name').textContent = 'Product not found.';
  }
}

loadProduct();

/* Handlers for this page's data-click / data-change / data-submit
   attributes (see actions.js). */
snrOn('click', 'logout', function (el, event) { logout(); });
