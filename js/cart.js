snrInitNav();
function logout() { snrLogout(); }

var cartData = null;

function renderCart(data) {
  cartData = data;
  var badge = document.getElementById('cartBadge');
  if (badge) {
    var count = data && data.item_count ? data.item_count : 0;
    if (count > 0) { badge.textContent = count; badge.style.display = 'flex'; }
    else badge.style.display = 'none';
  }
  var container = document.getElementById('cartItems');
  var emptyMsg  = document.getElementById('emptyMsg');
  container.querySelectorAll('.cart-item').forEach(function(el) { el.remove(); });

  if (!data || !data.items || data.items.length === 0) {
    emptyMsg.style.display = 'block';
    document.getElementById('subtotal').textContent = '€0';
    document.getElementById('shipping').textContent = '—';
    document.getElementById('total').textContent    = '€0';
    return;
  }
  emptyMsg.style.display = 'none';

  data.items.forEach(function(item) {
    var size = item.variant ? item.variant.size : '';
    var price = parseFloat(item.product.effective_price || item.product.price);
    var imgSrc = item.product.image || 'logo_mark_transparent_orange.png';
    var safeName = escHtml(item.product.name);
    var safeSize = escHtml(size);

    var div = document.createElement('div');
    div.className = 'cart-item';
    div.dataset.itemId = item.id;
    div.dataset.price  = price;
    div.innerHTML =
      '<img class="cart-item__img" src="' + escHtml(imgSrc) + '" alt="' + safeName + '">' +
      '<div class="cart-item__details">' +
        '<span class="cart-item__name">' + safeName + '</span>' +
        (size ? '<span class="cart-item__meta">Size: ' + safeSize + '</span>' : '') +
        /* added before sizes were required: checkout refuses it until fixed */
        (item.needs_size ? '<a class="cart-item__meta" style="color:var(--orange);" href="product?slug=' +
          encodeURIComponent(item.product.slug) + '">Size needed — remove and add again with a size</a>' : '') +
        /* guest carts: priced live, so a line can have sold out since */
        (item.problem && !item.needs_size ? '<span class="cart-item__meta" style="color:var(--orange);">' + escHtml(item.problem) + '</span>' : '') +
        '<span class="cart-item__price">' + formatEuro(price) + '</span>' +
      '</div>' +
      '<div class="cart-item__right">' +
        '<div class="qty-control">' +
          '<button class="qty-btn" data-click="changeQty" data-delta="-1">−</button>' +
          '<input class="qty-val" type="text" value="' + item.qty + '" readonly>' +
          '<button class="qty-btn" data-click="changeQty" data-delta="1">+</button>' +
        '</div>' +
        '<button class="cart-item__remove" data-click="removeItem">Remove</button>' +
      '</div>';
    container.insertBefore(div, emptyMsg);
  });

  var shipping = parseFloat(data.shipping || 0);
  document.getElementById('subtotal').textContent = formatEuro(parseFloat(data.total || 0));
  document.getElementById('shipping').textContent = shipping > 0 ? formatEuro(shipping) : 'Free';
  document.getElementById('total').textContent    = formatEuro(parseFloat(data.grand_total || data.total || 0));
}

async function loadCart() {
  renderCart(await snrCartGet());
}

async function changeQty(btn, delta) {
  var row    = btn.closest('.cart-item');
  var input  = row.querySelector('.qty-val');
  var oldQty = parseInt(input.value);
  var newQty = Math.max(1, oldQty + delta);
  if (newQty === oldQty) return;
  input.value = newQty;
  var result = await snrCartSetQty(row.dataset.itemId, newQty);
  if (result.cart) renderCart(result.cart);
  else {
    input.value = oldQty;
    if (result.error) alert(result.error);
  }
}

async function removeItem(btn) {
  var row = btn.closest('.cart-item');
  row.style.opacity = '0.4';
  var result = await snrCartSetQty(row.dataset.itemId, 0);
  if (result.cart) renderCart(result.cart);
  else row.style.opacity = '';
}

loadCart();
snrShowShippingRule(document.getElementById('shippingNote'));

/* Handlers for this page's data-click / data-change / data-submit
   attributes (see actions.js). */
snrOn('click', 'logout', function (el, event) { logout(); });
snrOn('click', 'changeQty', function (el, event) { changeQty(el, Number(el.dataset.delta)); });
snrOn('click', 'removeItem', function (el, event) { removeItem(el); });
