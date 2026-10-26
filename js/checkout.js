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
  renderSummary(await snrCartGet());
}

function renderSummary(cart) {
  var container = document.querySelector('.order-summary');
  var emptyEl   = document.getElementById('summaryEmpty');
  var totalsEl  = container.querySelector('.summary-totals');
  container.querySelectorAll('.summary-item').forEach(function(el) { el.remove(); });

  if (!cart) {
    emptyEl.textContent = 'Could not load your cart. Please refresh the page.';
    return;
  }
  cartIsEmpty = !cart.items.length;
  if (cartIsEmpty) {
    emptyEl.style.display = '';
    emptyEl.innerHTML = 'Your cart is empty. <a href="collection">Browse the collection →</a>';
    ['sumSubtotal', 'sumShipping', 'sumTotal'].forEach(function(id) { document.getElementById(id).textContent = '—'; });
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
    div.dataset.itemId = item.id;
    div.innerHTML =
      '<img class="summary-item__img" src="' + escHtml(item.product.image || '') + '" alt="' + safeName + '">' +
      '<div class="summary-item__info">' +
        '<p class="summary-item__name">' + safeName + '</p>' +
        (size ? '<p class="summary-item__meta">Size: ' + safeSize + '</p>' : '') +
        (item.problem ? '<p class="summary-item__meta" style="color:var(--orange);">' + escHtml(item.problem) + '</p>' : '') +
        '<div class="summary-qty">' +
          '<button type="button" class="summary-qty__btn" data-click="changeQty" data-delta="-1" aria-label="One less"' + (item.qty <= 1 ? ' disabled' : '') + '>−</button>' +
          '<span class="summary-qty__val">' + item.qty + '</span>' +
          '<button type="button" class="summary-qty__btn" data-click="changeQty" data-delta="1" aria-label="One more">+</button>' +
          '<button type="button" class="summary-qty__remove" data-click="removeItem">Remove</button>' +
        '</div>' +
      '</div>' +
      '<span class="summary-item__price">' + formatEuro(price * item.qty) + '</span>';
    container.insertBefore(div, totalsEl);
  });

  var shipping = parseFloat(cart.shipping || 0);
  document.getElementById('sumSubtotal').textContent = formatEuro(parseFloat(cart.total || 0));
  document.getElementById('sumShipping').textContent = shipping > 0 ? formatEuro(shipping) : 'Free';
  document.getElementById('sumTotal').textContent    = formatEuro(parseFloat(cart.grand_total || cart.total || 0));
}

/* Quantity changes on the summary. */
var summaryBusy = false;

async function setSummaryQty(el, qty) {
  if (paying || summaryBusy) return;
  var row = el.closest('.summary-item');
  summaryBusy = true;
  row.style.opacity = '0.5';
  var result = await snrCartSetQty(row.dataset.itemId, qty);
  summaryBusy = false;
  if (result.cart) {
    renderSummary(result.cart);
    snrUpdateCartBadge();
  } else {
    row.style.opacity = '';
    if (result.error) alert(result.error);
  }
}

/* No order exists until Viva confirms the payment: the backend keeps the
   basket as a "checkout" and the payment webhook turns it into the order.
   The cart stays as it is until then, so a declined card or a closed
   payment page just means placing the order again. */
var paying = false;

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

/* Asks the backend for a Viva payment page for the cart:
   {checkout_id, token, checkout_url} or {error}. */
async function startPayment(details) {
  var res;
  if (isSignedIn()) {
    res = await apiFetch('/payments/checkout/', {method: 'POST', body: JSON.stringify(details)});
    if (!res) return {error: 'Your session expired. Please sign in again.'};
  } else {
    details.items = snrGuestLines();
    res = await fetch(API_BASE + '/payments/guest-checkout/', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(details)
    });
  }
  var data = null;
  try { data = await res.json(); } catch (ex) {}
  if (res.ok && data && data.checkout_url) return data;
  return {error: errorText(data) || 'Could not reach the payment page. Please try again in a moment.'};
}

/* checkout-return reads these to find out whether the payment went
   through. A guest's paid lines are kept too, so only those leave the
   guest cart once paid (a signed-in cart is updated by the server).
   The customer picks card, Apple Pay or Google Pay on Viva's page. */
function goToPayment(checkout) {
  try {
    sessionStorage.setItem('snr_checkout_id', String(checkout.checkout_id));
    sessionStorage.setItem('snr_checkout_token', checkout.token);
    if (isSignedIn()) sessionStorage.removeItem('snr_checkout_lines');
    else sessionStorage.setItem('snr_checkout_lines', JSON.stringify(snrGuestLines()));
  } catch (ex) {}
  window.location.href = checkout.checkout_url;
}

function resetPlaceOrder(btn) {
  paying = false;
  btn.textContent = 'Place Order';
  btn.disabled = false;
}

/* Coming back with the browser's Back button from Viva's page can restore
   this page exactly as it was left (button disabled): make it usable again. */
window.addEventListener('pageshow', function(event) {
  if (event.persisted) {
    resetPlaceOrder(document.querySelector('.btn-place-order'));
    loadCartSummary();
  }
});


document.querySelector('.btn-place-order').addEventListener('click', async function() {
  var btn = this;
  if (paying) return;

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

  paying = true;
  btn.textContent = 'Redirecting to payment...';
  btn.disabled = true;

  try {
    var result = await startPayment(details);
    if (result.error) {
      alert(result.error);
      resetPlaceOrder(btn);
      loadCartSummary();
      return;
    }
    goToPayment(result);
  } catch (ex) {
    alert('Network error. Please try again.');
    resetPlaceOrder(btn);
  }
});

/* Handlers for this page's data-click / data-change / data-submit
   attributes (see actions.js). */
snrOn('click', 'logout', function (el, event) { logout(); });
snrOn('click', 'loginCheckout', function (el, event) { loginCheckout(); });
snrOn('click', 'startCheckout', function (el, event) { startCheckout(); });
snrOn('click', 'changeQty', function (el, event) {
  var current = parseInt(el.closest('.summary-item').querySelector('.summary-qty__val').textContent, 10);
  var next = current + Number(el.dataset.delta);
  if (next >= 1) setSummaryQty(el, next);
});
snrOn('click', 'removeItem', function (el, event) { setSummaryQty(el, 0); });
