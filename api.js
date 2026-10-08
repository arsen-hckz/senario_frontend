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
async function snrStartPayment(orderId) {
  var res = await apiFetch('/payments/checkout/' + orderId + '/', {method: 'POST'});
  if (res && res.ok) {
    var data = await res.json();
    sessionStorage.setItem('snr_pending_order_id', String(orderId));
    window.location.href = data.checkout_url;
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
  if (refresh) {
    apiFetch('/auth/logout/', {method: 'POST', body: JSON.stringify({refresh: refresh})}).catch(function() {});
  }
  localStorage.removeItem('snr_token');
  localStorage.removeItem('snr_refresh');
  localStorage.removeItem('snr_is_staff');
  if (redirect !== false) window.location.href = 'index.html';
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
  if (!localStorage.getItem('snr_token')) {
    badge.style.display = 'none';
    return;
  }
  try {
    var res = await apiFetch('/cart/');
    if (!res || !res.ok) return;
    var cart = await res.json();
    var count = cart.item_count || 0;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  } catch (ex) {}
}
