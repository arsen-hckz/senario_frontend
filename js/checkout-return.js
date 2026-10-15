/* Viva redirects here after both successful and failed/cancelled
   payments. We never infer the outcome from the redirect itself —
   the only source of truth is our own backend, which independently
   verified the payment via Viva's API in the webhook. So this page
   just polls the order until the webhook has (or hasn't, yet) landed. */

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

async function pollOrder(orderId, attempt) {
  var res = await apiFetch('/orders/' + orderId + '/');
  if (res && res.ok) {
    var order = await res.json();
    if (order.status === 'cancelled') {
      setState(
        ICON_CLOCK, false,
        'Order cancelled',
        'This order was cancelled, so it can no longer be paid. If you were charged, we will refund you — contact us if you have any questions.',
        '<a class="btn btn--primary" href="account-orders">View My Orders</a>' +
        '<a class="btn btn--secondary" href="collection">Continue Shopping</a>'
      );
      return;
    }
    if (order.status && order.status !== 'pending') {
      document.getElementById('statusIcon').style.color = 'var(--green)';
      document.getElementById('statusIcon').style.borderColor = 'var(--green)';
      setState(
        ICON_CHECK, false,
        'Payment confirmed',
        'Thank you — your order is confirmed and on its way to being packed.',
        '<a class="btn btn--primary" href="account-orders">View My Orders</a>' +
        '<a class="btn btn--secondary" href="collection">Continue Shopping</a>'
      );
      return;
    }
  }

  if (attempt >= MAX_ATTEMPTS) {
    setState(
      ICON_CLOCK, false,
      'Payment not confirmed yet',
      'If you completed payment, it will show as confirmed in My Orders within a few minutes. If your card was declined or you cancelled, you can try again.',
      '<a class="btn btn--primary" href="account-orders">Check My Orders</a>' +
      '<button class="btn btn--secondary" type="button" id="retryPayment">Try Payment Again</button>'
    );
    document.getElementById('retryPayment').addEventListener('click', async function () {
      this.disabled = true;
      this.textContent = 'Redirecting...';
      var error = await snrStartPayment(orderId);
      if (error) {
        alert(error);
        this.disabled = false;
        this.textContent = 'Try Payment Again';
      }
    });
    return;
  }

  setTimeout(function () { pollOrder(orderId, attempt + 1); }, POLL_INTERVAL_MS);
}

(function init() {
  var orderId = sessionStorage.getItem('snr_pending_order_id');
  if (!orderId) {
    setState(
      ICON_CLOCK, false,
      'Payment status unknown',
      'We couldn\'t find which order this was for. Check My Orders for the latest status.',
      '<a class="btn btn--primary" href="account-orders">Check My Orders</a>'
    );
    return;
  }
  document.getElementById('statusOrder').textContent = 'Order #' + orderId;
  sessionStorage.removeItem('snr_pending_order_id');
  pollOrder(orderId, 1);
})();
