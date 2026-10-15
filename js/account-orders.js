if (!localStorage.getItem('snr_token')) window.location.href = 'login';

/* An unpaid order (card declined, payment page closed) can be paid
   from here — the cart was already emptied when the order was placed. */
async function payOrder(orderId, btn) {
  btn.disabled = true;
  btn.textContent = 'Redirecting...';
  var error = await snrStartPayment(orderId);
  if (error) {
    alert(error);
    btn.disabled = false;
    btn.textContent = 'Complete Payment';
  }
}

function toggleOrder(header) {
  header.parentElement.classList.toggle('open');
}

async function renderOrders() {
  var list = document.getElementById('orderList');
  list.innerHTML = '<p style="color:var(--gray);padding:24px;font-family:var(--ff-body);">Loading orders...</p>';

  try {
    var res = await apiFetch('/orders/');
    if (!res || !res.ok) throw new Error();
    var data = await res.json();
    var orders = Array.isArray(data) ? data : (data.results || []);
    list.innerHTML = '';

    if (!orders.length) {
      list.innerHTML = '<div class="empty-state"><div class="empty-state__icon">&#9781;</div><p class="empty-state__text">No orders yet</p><a class="btn-ghost" href="collection">Shop the Collection</a></div>';
      return;
    }

    orders.forEach(function(order) {
      var date   = new Date(order.created_at).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'});
      var total  = parseFloat(order.total || 0);
      var badge  = 'order-badge--' + order.status;
      var itemsHTML = (order.items || []).map(function(item) {
        return '<div class="order-item">' +
          (item.image
            ? '<img class="order-item__img" src="' + escHtml(item.image) + '" alt="" loading="lazy">'
            : '<div class="order-item__img"></div>') +
          '<div><div class="order-item__name">' + escHtml(item.product_name) + '</div>' +
          '<div class="order-item__meta">' + (item.size ? 'Size ' + escHtml(item.size) + ' &nbsp;·&nbsp; ' : '') + 'Qty ' + item.qty + '</div></div>' +
          '<div class="order-item__price">' + formatEuro(parseFloat(item.price)) + '</div>' +
          '</div>';
      }).join('');

      var card = document.createElement('div');
      card.className = 'order-card';
      card.innerHTML =
        '<div class="order-card__header" data-click="toggleOrder">' +
          '<div><div class="order-label">Order</div><div class="order-value">#' + order.id + '</div></div>' +
          '<div><div class="order-label">Date</div><div class="order-value">' + date + '</div></div>' +
          '<div><span class="order-badge ' + badge + '">' + order.status + '</span></div>' +
          '<div class="order-chevron">▾</div>' +
        '</div>' +
        '<div class="order-card__body">' + itemsHTML +
          '<div class="order-total">Total &nbsp;<strong>' + formatEuro(total) + '</strong></div>' +
          (order.status === 'pending'
            ? '<div style="margin-top:16px;text-align:right;"><button class="btn-ghost" type="button" data-click="payOrder" data-order-id="' + order.id + '">Complete Payment</button></div>'
            : '') +
        '</div>';
      list.appendChild(card);
    });
  } catch (ex) {
    list.innerHTML = '<p style="color:var(--gray);padding:24px;font-family:var(--ff-body);">Could not load orders.</p>';
  }
}

snrInitNav();
function logout() { snrLogout(); }
renderOrders();

/* Handlers for this page's data-click / data-change / data-submit
   attributes (see actions.js). */
snrOn('click', 'logout', function (el, event) { logout(); });
snrOn('click', 'toggleOrder', function (el, event) { toggleOrder(el); });
snrOn('click', 'payOrder', function (el, event) { payOrder(Number(el.dataset.orderId), el); });
