snrInitNav();
function logout() { snrLogout(); }

function isSignedIn() { return !!localStorage.getItem('snr_token'); }

function loginCheckout() {
  window.location.href = 'login?next=checkout';
}

function startCheckout() {
  document.getElementById('authGate').style.display = 'none';
  document.getElementById('checkoutLayout').style.display = 'grid';
  loadCartSummary();
  if (isSignedIn()) prefillEmail();
  snrShowShippingRule(document.getElementById('shippingNote'));
}

/* Order confirmations go to the account email unless another is typed. */
async function prefillEmail() {
  var input = document.querySelector('.checkout-form input[type="email"]');
  if (!input || input.value) return;
  try {
    var res = await apiFetch('/auth/profile/');
    if (res && res.ok && !input.value) input.value = (await res.json()).email || '';
  } catch (ex) {}
}

if (isSignedIn()) {
  startCheckout();
}

var cartIsEmpty = true;

async function loadCartSummary() {
  var container = document.querySelector('.order-summary');
  var emptyEl   = document.getElementById('summaryEmpty');
  var totalsEl  = container.querySelector('.summary-totals');
  container.querySelectorAll('.summary-item').forEach(function(el) { el.remove(); });

  var cart = await snrCartGet();
  if (!cart) {
    emptyEl.textContent = 'Could not load your cart. Please refresh the page.';
    return;
  }
  cartIsEmpty = !cart.items.length;
  if (cartIsEmpty) {
    emptyEl.innerHTML = 'Your cart is empty. <a href="collection">Browse the collection →</a>';
    return;
  }
  emptyEl.style.display = 'none';

  cart.items.forEach(function(item) {
    var price = parseFloat(item.product.effective_price || item.product.price);
    var size  = item.variant ? item.variant.size : '';
    var safeName = escHtml(item.product.name);
    var safeSize = escHtml(size);
    var div   = document.createElement('div');
    div.className = 'summary-item';
    div.innerHTML =
      '<img class="summary-item__img" src="' + escHtml(item.product.image || '') + '" alt="' + safeName + '">' +
      '<div class="summary-item__info">' +
        '<p class="summary-item__name">' + safeName + '</p>' +
        '<p class="summary-item__meta">' + (size ? 'Size: ' + safeSize + ' — ' : '') + 'Qty: ' + item.qty + '</p>' +
        (item.problem ? '<p class="summary-item__meta" style="color:var(--orange);">' + escHtml(item.problem) + '</p>' : '') +
      '</div>' +
      '<span class="summary-item__price">' + formatEuro(price * item.qty) + '</span>';
    container.insertBefore(div, totalsEl);
  });

  var shipping = parseFloat(cart.shipping || 0);
  document.getElementById('sumSubtotal').textContent = formatEuro(parseFloat(cart.total || 0));
  document.getElementById('sumShipping').textContent = shipping > 0 ? formatEuro(shipping) : 'Free';
  document.getElementById('sumTotal').textContent    = formatEuro(parseFloat(cart.grand_total || cart.total || 0));
}

/* Order creation and payment are separate steps against the API. We keep
   the created order (and a guest order's secret) in memory so a failed or
   retried "start payment" never creates a second order behind the
   customer's back. */
var createdOrderId = null;
var createdOrderToken = null;

function readForm() {
  var vals = {};
  document.querySelectorAll('.checkout-form input, .checkout-form select').forEach(function(el) {
    var lbl = el.previousElementSibling;
    if (lbl) vals[lbl.textContent.trim()] = el.value.trim();
  });
  var countryEl = document.querySelector('.checkout-form select');
  return {
    full_name:   ((vals['First Name'] || '') + ' ' + (vals['Last Name'] || '')).trim(),
    email:       vals['Email'] || '',
    phone:       vals['Phone'] || '',
    address:     vals['Address'] || '',
    city:        vals['City'] || '',
    country:     countryEl ? countryEl.value : 'Greece',
    postal_code: vals['Postal Code'] || ''
  };
}

/* DRF errors: {"field": ["msg"]} or {"detail": "msg"} or ["msg"]. */
function errorText(err) {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (Array.isArray(err)) return err.map(errorText).join(' ');
  return Object.keys(err).map(function(k) { return errorText(err[k]); }).join(' ');
}

async function placeOrder(details) {
  if (isSignedIn()) {
    var res = await apiFetch('/orders/create/', {method: 'POST', body: JSON.stringify(details)});
    if (!res) return {error: 'Your session expired. Please sign in again.'};
    var data = await res.json();
    return res.ok ? {order: data, token: null} : {error: errorText(data)};
  }
  details.items = snrGuestLines();
  var gres = await fetch(API_BASE + '/orders/guest/', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(details)
  });
  var gdata = await gres.json();
  if (!gres.ok) return {error: errorText(gdata)};
  /* The order now holds these items, as the server cart is emptied for
     signed-in customers. */
  snrSaveGuestLines([]);
  snrUpdateCartBadge();
  return {order: gdata, token: gdata.access_token};
}

document.querySelector('.btn-place-order').addEventListener('click', async function() {
  var btn = this;

  if (createdOrderId) {
    btn.textContent = 'Redirecting to payment...';
    btn.disabled = true;
    var retryError = await snrStartPayment(createdOrderId, createdOrderToken);
    if (retryError) {
      alert(retryError);
      btn.textContent = 'Retry Payment';
      btn.disabled = false;
    }
    return;
  }

  if (cartIsEmpty) {
    alert('Your cart is empty.');
    return;
  }
  var details = readForm();
  if (!details.full_name || !details.phone || !details.address || !details.city || !details.postal_code) {
    alert('Please fill in your name, phone and shipping address.');
    return;
  }
  if (!isSignedIn() && !details.email) {
    alert('Please enter your email — your receipt and order link are sent there.');
    return;
  }

  btn.textContent = 'Placing order...';
  btn.disabled = true;

  try {
    var result = await placeOrder(details);
    if (result.error) {
      alert(result.error || 'Order failed. Please try again.');
      btn.textContent = 'Place Order';
      btn.disabled = false;
      loadCartSummary();
      return;
    }
    createdOrderId = result.order.id;
    createdOrderToken = result.token;
    btn.textContent = 'Redirecting to payment...';
    var startError = await snrStartPayment(createdOrderId, createdOrderToken);
    if (startError) {
      alert('Your order #' + createdOrderId + ' is saved, but payment could not start: ' + startError +
            ' You can retry here' + (createdOrderToken ? '.' : ' or from My Orders.'));
      btn.textContent = 'Retry Payment';
      btn.disabled = false;
    }
  } catch (ex) {
    alert('Network error. Please try again.');
    btn.textContent = 'Place Order';
    btn.disabled = false;
  }
});

/* Handlers for this page's data-click / data-change / data-submit
   attributes (see actions.js). */
snrOn('click', 'logout', function (el, event) { logout(); });
snrOn('click', 'loginCheckout', function (el, event) { loginCheckout(); });
snrOn('click', 'startCheckout', function (el, event) { startCheckout(); });
