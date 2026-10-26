/* Viva redirects here after both successful and failed/cancelled
   payments. We never infer the outcome from the redirect itself —
   the only source of truth is our own backend, which creates the order
   only after it has verified the payment with Viva in the webhook. So this
   page just polls the checkout until that order exists (or doesn't, yet). */

var POLL_INTERVAL_MS = 2000;
var MAX_ATTEMPTS = 10;

function setState(iconSvg, spinning, title, body, actionsHtml) {
  var icon = document.getElementById('statusIcon');
  icon.classList.toggle('status-icon--spin', spinning);
  icon.innerHTML = iconSvg;
  document.getElementById('statusTitle').textContent = title;
  document.getElementById('statusBody').textContent = body;
  var actions = document.getElementById('statusActions');
  if (actionsHtml) {
    actions.innerHTML = actionsHtml;
    actions.style.display = 'flex';
  }
}

var ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="' + 'currentColor' + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
var ICON_CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>';

var checkoutId = null;
var checkoutToken = null;

/* A guest's order opens with the checkout's secret; account orders are in My Orders. */
function orderLink(status, label) {
  return status.is_guest
    ? '<a class="btn btn--primary" href="order?id=' + encodeURIComponent(status.order_id) + '#t=' + encodeURIComponent(checkoutToken) + '">' + (label || 'View Your Order') + '</a>'
    : '<a class="btn btn--primary" href="account-orders">' + (label || 'View My Orders') + '</a>';
}

async function fetchStatus() {
  try {
    var res = await fetch(API_BASE + '/payments/checkout/' + encodeURIComponent(checkoutId) + '/', {
      headers: {'X-Checkout-Token': checkoutToken}
    });
    return res.ok ? await res.json() : null;
  } catch (ex) { return null; }
}

/* Only what was paid for leaves a guest's cart; anything added since stays. */
function removePaidGuestLines() {
  var paid = [];
  try { paid = JSON.parse(sessionStorage.getItem('snr_checkout_lines') || '[]'); } catch (ex) {}
  if (!Array.isArray(paid) || !paid.length) return;
  var key = function(l) { return l.product_id + '-' + (l.variant_id || 0); };
  var paidKeys = paid.map(key);
  snrSaveGuestLines(snrGuestLines().filter(function(l) { return paidKeys.indexOf(key(l)) === -1; }));
}

function forgetCheckout() {
  try {
    sessionStorage.removeItem('snr_checkout_id');
    sessionStorage.removeItem('snr_checkout_token');
    sessionStorage.removeItem('snr_checkout_lines');
  } catch (ex) {}
}

async function poll(attempt) {
  var status = await fetchStatus();
  if (status && status.paid) {
    if (status.is_guest) removePaidGuestLines();
    forgetCheckout();
    snrUpdateCartBadge();
    document.getElementById('statusOrder').textContent = 'Order #' + status.order_id;

    if (status.order_status === 'cancelled') {
      setState(
        ICON_CLOCK, false,
        'Order cancelled',
        'This order was cancelled. If you were charged, we will refund you — contact us if you have any questions.',
        orderLink(status) +
        '<a class="btn btn--secondary" href="collection">Continue Shopping</a>'
      );
      return;
    }
    document.getElementById('statusIcon').style.color = 'var(--green)';
    document.getElementById('statusIcon').style.borderColor = 'var(--green)';
    setState(
      ICON_CHECK, false,
      'Payment confirmed',
      'Thank you — your order is confirmed and on its way to being packed. Your receipt is on its way to your email.',
      orderLink(status) +
      '<a class="btn btn--secondary" href="collection">Continue Shopping</a>'
    );
    return;
  }

  if (attempt >= MAX_ATTEMPTS) {
    /* The checkout stays in sessionStorage, so refreshing this page checks again. */
    setState(
      ICON_CLOCK, false,
      'Payment not confirmed yet',
      'If you completed the payment, your order will be confirmed within a few minutes and you will get an email with your receipt — refresh this page to check again. ' +
        'If your card was declined or you closed the payment page, no order was placed and nothing was charged: your cart is still there, so you can try again.',
      '<a class="btn btn--primary" href="checkout">Back to Checkout</a>' +
      '<a class="btn btn--secondary" href="collection">Continue Shopping</a>'
    );
    return;
  }

  setTimeout(function () { poll(attempt + 1); }, POLL_INTERVAL_MS);
}

(function init() {
  try {
    checkoutId = sessionStorage.getItem('snr_checkout_id');
    checkoutToken = sessionStorage.getItem('snr_checkout_token');
  } catch (ex) {}
  if (!checkoutId || !checkoutToken) {
    var signedIn = !!localStorage.getItem('snr_token');
    setState(
      ICON_CLOCK, false,
      'Payment status unknown',
      'We couldn\'t find which payment this was for. If you paid, your confirmation email has your order details' +
        (signedIn ? ', and the order is in My Orders.' : '.'),
      signedIn
        ? '<a class="btn btn--primary" href="account-orders">Check My Orders</a>'
        : '<a class="btn btn--primary" href="collection">Continue Shopping</a>'
    );
    return;
  }
  poll(1);
})();
