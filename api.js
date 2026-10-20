var API_BASE = 'https://snr.arsenidis.dev/api';

function escHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Prices as charged: €25 for whole amounts, €24.50 otherwise — never rounded,
   so what the customer sees always matches what Viva charges. */
function formatEuro(value) {
  var n = parseFloat(value || 0);
  return '€' + (Number.isInteger(n) ? String(n) : n.toFixed(2));
}

async function apiFetch(path, opts) {
  opts = opts || {};
  var url = API_BASE + path;
  var isFormData = opts.body instanceof FormData;
  var headers = isFormData ? {} : Object.assign({'Content-Type': 'application/json'}, opts.headers || {});
  var token = localStorage.getItem('snr_token');
  if (token) headers['Authorization'] = 'Bearer ' + token;

  var res = await fetch(url, Object.assign({}, opts, {headers: headers}));

  if (res.status === 401) {
    var access = await snrRefreshAccessToken();
    if (!access) {
      snrLogout(false);
      return null;
    }
    headers['Authorization'] = 'Bearer ' + access;
    res = await fetch(url, Object.assign({}, opts, {headers: headers}));
  }

  return res;
}

/* Start (or retry) payment for one of the customer's own orders: asks the
   backend for a Viva checkout and redirects there. Returns null when the
   redirect is under way, or a message to show when it couldn't start
   (already paid, cancelled, an item sold out, Viva unreachable). */
/* Viva's payment page opens on this method first: 0 card, 20 Apple Pay,
   21 Google Pay. The customer can still switch there. */
var SNR_PAYMENT_METHODS = ['0', '20', '21'];

async function snrStartPayment(orderId, guestToken, paymentMethod) {
  var res;
  try {
    res = guestToken
      ? await fetch(API_BASE + '/payments/guest-checkout/' + orderId + '/', {
          method: 'POST', headers: {'X-Order-Token': guestToken}
        })
      : await apiFetch('/payments/checkout/' + orderId + '/', {method: 'POST'});
  } catch (ex) { res = null; }
  if (res && res.ok) {
    var data = await res.json();
    sessionStorage.setItem('snr_pending_order_id', String(orderId));
    if (guestToken) sessionStorage.setItem('snr_pending_order_token', guestToken);
    else sessionStorage.removeItem('snr_pending_order_token');
    var url = data.checkout_url;
    if (SNR_PAYMENT_METHODS.indexOf(String(paymentMethod)) !== -1) {
      url += (url.indexOf('?') === -1 ? '?' : '&') + 'paymentMethod=' + paymentMethod;
    }
    window.location.href = url;
    return null;
  }
  var detail = null;
  try { detail = res ? (await res.json()).detail : null; } catch (ex) {}
  return detail || 'Could not reach the payment page. Please try again in a moment.';
}

/* The backend rotates refresh tokens: every refresh returns a new one and
   blacklists the old. So the new one must be saved, and parallel 401s must
   share a single refresh call — otherwise the second call presents the
   just-blacklisted token and logs the customer out. */
var snrRefreshInFlight = null;

function snrRefreshAccessToken() {
  if (snrRefreshInFlight) return snrRefreshInFlight;
  var refresh = localStorage.getItem('snr_refresh');
  if (!refresh) return Promise.resolve(null);

  snrRefreshInFlight = (async function() {
    try {
      var rr = await fetch(API_BASE + '/auth/refresh/', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({refresh: refresh})
      });
      if (!rr.ok) return null;
      var data = await rr.json();
      localStorage.setItem('snr_token', data.access);
      if (data.refresh) localStorage.setItem('snr_refresh', data.refresh);
      return data.access;
    } catch (ex) {
      return null;
    } finally {
      snrRefreshInFlight = null;
    }
  })();
  return snrRefreshInFlight;
}

function snrLogout(redirect) {
  var refresh = localStorage.getItem('snr_refresh');
  /* Plain fetch, no access token: after an idle hour it has expired, and
     apiFetch's 401 handling would give up before the refresh token is revoked.
     keepalive lets the request finish while the page redirects. */
  if (refresh) {
    fetch(API_BASE + '/auth/logout/', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({refresh: refresh}),
      keepalive: true
    }).catch(function() {});
  }
  localStorage.removeItem('snr_token');
  localStorage.removeItem('snr_refresh');
  localStorage.removeItem('snr_is_staff');
  if (redirect !== false) window.location.href = '/';
}

function snrInitNav() {
  if (localStorage.getItem('snr_token')) {
    var l = document.getElementById('headerLogin');
    var m = document.getElementById('accountMenu');
    if (l) l.style.display = 'none';
    if (m) m.style.display = 'flex';
  }
  if (localStorage.getItem('snr_is_staff') === '1') {
    var a = document.getElementById('adminLink');
    if (a) a.style.display = 'block';
  }
  var trigger = document.getElementById('accountTrigger');
  var drop    = document.getElementById('accountDropdown');
  if (trigger && drop) {
    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      drop.classList.toggle('open');
    });
    document.addEventListener('click', function() {
      drop.classList.remove('open');
    });
  }
  snrUpdateCartBadge();
  snrRevealSaleNav();
}

/* "Sale" nav link starts hidden (see markup) and only appears once at
   least one sale post exists, so an empty storefront never shows a dead link */
function snrRevealSaleNav() {
  var link = document.getElementById('navSale');
  if (!link || typeof getSalePosts !== 'function') return;
  getSalePosts().then(function(posts) {
    if (posts.length) link.style.display = '';
  }).catch(function() {});
}

async function snrUpdateCartBadge() {
  var badge = document.getElementById('cartBadge');
  if (!badge) return;
  var count = 0;
  if (!localStorage.getItem('snr_token')) {
    count = snrGuestLines().reduce(function(sum, l) { return sum + l.qty; }, 0);
  } else {
    try {
      var res = await apiFetch('/cart/');
      if (!res || !res.ok) return;
      count = (await res.json()).item_count || 0;
    } catch (ex) { return; }
  }
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

/* ── CART ──
   Signed in: the cart lives on the server (/cart/).
   Guest: a list of {product_id, variant_id, qty} in localStorage. Prices,
   stock and shipping always come from /cart/quote/, which answers in the
   same shape as /cart/, so pages render both the same way. A guest line's
   id is "<product id>-<size id or 0>". */
var SNR_GUEST_CART = 'snr_guest_cart';

function snrGuestLines() {
  try {
    var lines = JSON.parse(localStorage.getItem(SNR_GUEST_CART) || '[]');
    return Array.isArray(lines) ? lines.filter(function(l) { return l && l.product_id && l.qty > 0; }) : [];
  } catch (ex) { return []; }
}

function snrSaveGuestLines(lines) {
  try {
    if (lines.length) localStorage.setItem(SNR_GUEST_CART, JSON.stringify(lines));
    else localStorage.removeItem(SNR_GUEST_CART);
  } catch (ex) {}
}

function snrLineKey(line) {
  return line.product_id + '-' + (line.variant_id || 0);
}

async function snrQuote(lines) {
  try {
    var res = await fetch(API_BASE + '/cart/quote/', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({items: lines})
    });
    return res.ok ? await res.json() : null;
  } catch (ex) { return null; }
}

/* The current cart, or null if it couldn't be loaded. */
async function snrCartGet() {
  if (localStorage.getItem('snr_token')) {
    try {
      var res = await apiFetch('/cart/');
      return res && res.ok ? await res.json() : null;
    } catch (ex) { return null; }
  }
  var lines = snrGuestLines();
  if (!lines.length) return {items: [], total: '0', shipping: '0', grand_total: '0', item_count: 0};
  var quote = await snrQuote(lines);
  if (quote) {
    /* Keep the stored cart in step: products taken down are dropped. */
    snrSaveGuestLines(quote.items.map(function(item) {
      return {product_id: item.product.id, variant_id: item.variant ? item.variant.id : null, qty: item.qty};
    }));
  }
  return quote;
}

/* Adds to the cart. Returns null when added, else a message to show
   ("Only 2 left in stock.", "Please choose a size."). */
async function snrCartAdd(productId, variantId, qty) {
  qty = qty || 1;
  if (localStorage.getItem('snr_token')) {
    var payload = {product_id: productId, qty: qty};
    if (variantId) payload.variant_id = Number(variantId);
    try {
      var res = await apiFetch('/cart/', {method: 'POST', body: JSON.stringify(payload)});
      if (res && res.ok) return null;
      var detail = null;
      try { detail = res ? (await res.json()).detail : null; } catch (ex) {}
      return detail || 'Could not add to cart.';
    } catch (ex) { return 'Network error. Please try again.'; }
  }
  var line = {product_id: productId, variant_id: variantId ? Number(variantId) : null, qty: qty};
  var lines = snrGuestLines();
  var existing = lines.filter(function(l) { return snrLineKey(l) === snrLineKey(line); })[0];
  var newQty = qty + (existing ? existing.qty : 0);
  if (newQty > 99) return 'You can add up to 99 of an item.';
  var quote = await snrQuote([{product_id: line.product_id, variant_id: line.variant_id, qty: newQty}]);
  if (!quote) return 'Network error. Please try again.';
  if (!quote.items.length) return 'This item is no longer available.';
  if (quote.items[0].problem) return quote.items[0].problem;
  if (existing) existing.qty = newQty;
  else lines.push(line);
  snrSaveGuestLines(lines);
  snrUpdateCartBadge();
  return null;
}

/* Sets a line's quantity (0 removes it). Returns {cart, error}. */
async function snrCartSetQty(itemId, qty) {
  if (localStorage.getItem('snr_token')) {
    try {
      var res = qty > 0
        ? await apiFetch('/cart/' + itemId + '/', {method: 'PATCH', body: JSON.stringify({qty: qty})})
        : await apiFetch('/cart/', {method: 'DELETE', body: JSON.stringify({item_id: Number(itemId)})});
      if (res && res.ok) return {cart: await res.json(), error: null};
      var detail = null;
      try { detail = res ? (await res.json()).detail : null; } catch (ex) {}
      return {cart: null, error: detail || 'Could not update your cart.'};
    } catch (ex) { return {cart: null, error: 'Network error. Please try again.'}; }
  }
  var lines = snrGuestLines();
  var line = lines.filter(function(l) { return snrLineKey(l) === String(itemId); })[0];
  if (line && qty > 0) {
    var quote = await snrQuote([{product_id: line.product_id, variant_id: line.variant_id, qty: qty}]);
    var problem = quote && quote.items[0] ? quote.items[0].problem : null;
    if (problem && problem !== 'Please choose a size.') return {cart: null, error: problem};
    line.qty = qty;
  } else {
    lines = lines.filter(function(l) { return snrLineKey(l) !== String(itemId); });
  }
  snrSaveGuestLines(lines);
  return {cart: await snrCartGet(), error: null};
}

/* "Free delivery on orders over €50." under a cart/checkout summary. */
async function snrShowShippingRule(el) {
  if (!el) return;
  try {
    var res = await fetch(API_BASE + '/orders/shipping/');
    if (!res.ok) return;
    var rule = await res.json();
    el.textContent = rule.free_over ? 'Free delivery on orders over ' + formatEuro(rule.free_over) + '.' : '';
  } catch (ex) {}
}

/* After signing in: move what was added as a guest into the account's
   cart. Best effort — anything the server refuses (sold out) is dropped. */
async function snrMergeGuestCart() {
  var lines = snrGuestLines();
  for (var i = 0; i < lines.length; i++) {
    var payload = {product_id: lines[i].product_id, qty: lines[i].qty};
    if (lines[i].variant_id) payload.variant_id = lines[i].variant_id;
    try { await apiFetch('/cart/', {method: 'POST', body: JSON.stringify(payload)}); } catch (ex) {}
  }
  snrSaveGuestLines([]);
}
