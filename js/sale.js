gsap.registerPlugin(ScrollTrigger);

async function renderPosts() {
  var grid  = document.getElementById('postGrid');
  var count = document.getElementById('postCount');
  grid.innerHTML = '<p style="color:var(--gray);text-align:center;padding:60px 0;font-family:var(--ff-body);">Loading...</p>';

  try {
    var posts = await hydrateSalePosts(await getSalePosts());

    if (!posts.length) {
      if (count) count.textContent = '';
      grid.innerHTML = '';
      document.querySelector('.product-section').innerHTML =
        '<p class="sale-empty">No sale posts yet — check back soon.</p>';
      return;
    }

    if (count) count.textContent = posts.length + ' Post' + (posts.length === 1 ? '' : 's');
    grid.innerHTML = '';

    posts.forEach(function(post, i) {
      var p = post.product;
      var totalStock = p.variants && p.variants.length
        ? p.variants.reduce(function(s, v) { return s + (v.stock || 0); }, 0)
        : (p.stock || 0);
      var oos    = totalStock === 0;
      var low    = !oos && totalStock < 10;
      var effPrice  = parseFloat(p.effective_price || p.price);
      var origPrice = parseFloat(p.price);
      var onSale    = p.sale_price && effPrice < origPrice;

      var stockTag = oos ? '<span class="stock-tag stock-tag--oos">Out of Stock</span>'
                   : low ? '<span class="stock-tag stock-tag--low">Low Stock</span>'
                   : '';

      var atcBtn = oos
        ? '<button class="product-card__atc oos" data-click="stopPropagation">Out of Stock</button>'
        : (p.variants && p.variants.length)
        /* Sized products need a size, which only the product page asks for. */
        ? '<button class="product-card__atc" data-slug="' + escHtml(p.slug) + '" data-click="chooseSize">Choose Size</button>'
        : '<button class="product-card__atc" data-click="addToCart" data-product-id="' + p.id + '">Add to Cart</button>';

      var safeName = escHtml(p.name);
      var nameHtml = oos
        ? '<div class="product-card__name-row"><span class="product-card__name">' + safeName + '</span><span class="product-card__oos-label">Out of Stock</span></div>'
        : '<span class="product-card__name">' + safeName + '</span>';

      var priceHtml = onSale
        ? '<div class="product-card__price-wrap"><span class="product-card__price--original">' + formatEuro(origPrice) + '</span><span class="product-card__price--sale">' + formatEuro(effPrice) + '</span></div>'
        : '<span class="product-card__price">' + formatEuro(effPrice) + '</span>';

      var captionHtml =
        '<div class="post-card__caption">' +
          '<span class="post-card__headline">' + escHtml(post.headline) + '</span>' +
          (post.note ? '<span class="post-card__note">' + escHtml(post.note) + '</span>' : '') +
        '</div>';

      var imgSrc = p.image || 'test images/TS01556BLK.jpg';

      var card = document.createElement('a');
      card.className = 'product-card' + (oos ? ' product-card--oos' : '');
      card.href = 'product?slug=' + p.slug;
      card.innerHTML =
        '<div class="product-card__image">' +
          '<img src="' + imgSrc + '" alt="' + safeName + '">' +
          captionHtml + stockTag + atcBtn +
        '</div>' +
        '<div class="product-card__info">' +
          nameHtml + priceHtml +
        '</div>';

      card.style.opacity = '0';
      card.style.transform = 'translateY(24px)';
      grid.appendChild(card);
    });

    ScrollTrigger.refresh();
    grid.querySelectorAll('.product-card').forEach(function(card, i) {
      gsap.to(card, {
        opacity: 1, y: 0, duration: 0.8, ease: 'power3.out',
        delay: i * 0.08,
        scrollTrigger: { trigger: card, start: 'top 92%', toggleActions: 'play none none none' }
      });
    });
  } catch (ex) {
    grid.innerHTML = '<p style="color:var(--gray);text-align:center;padding:60px 0;font-family:var(--ff-body);">Failed to load sale posts. Make sure the server is running.</p>';
  }
}

function chooseSize(e, btn) {
  e.preventDefault();
  e.stopPropagation();
  window.location.href = 'product?slug=' + encodeURIComponent(btn.dataset.slug);
}

async function addToCart(e, btn, productId) {
  e.preventDefault();
  e.stopPropagation();
  if (btn.classList.contains('added') || btn.classList.contains('oos')) return;
  var orig = btn.textContent;
  btn.textContent = '...';
  btn.disabled = true;
  // Signed in or not: guests get a cart in the browser (see api.js).
  var error = await snrCartAdd(productId, null, 1);
  if (!error) {
    btn.textContent = '✓ Added';
    btn.classList.add('added');
    snrUpdateCartBadge();
    setTimeout(function() {
      btn.classList.remove('added');
      btn.textContent = orig;
      btn.disabled = false;
    }, 2000);
  } else {
    btn.textContent = error;
    setTimeout(function() {
      btn.textContent = orig;
      btn.disabled = false;
    }, 2500);
  }
}

snrInitNav();
function logout() { snrLogout(); }
renderPosts();

/* Handlers for this page's data-click / data-change / data-submit
   attributes (see actions.js). */
snrOn('click', 'logout', function (el, event) { logout(); });
snrOn('click', 'stopPropagation', function (el, event) { event.stopPropagation(); });
snrOn('click', 'chooseSize', function (el, event) { chooseSize(event, el); });
snrOn('click', 'addToCart', function (el, event) { addToCart(event, el, Number(el.dataset.productId)); });
