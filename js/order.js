/* A guest's order, opened from the confirmation email or the payment
   return page: order?id=12#t=<secret>. The secret sits after "#", so it
   never reaches a server log, and goes to the API in a header. */

var params = new URLSearchParams(location.search);
var orderId = params.get('id');
var token = new URLSearchParams(location.hash.slice(1)).get('t');

var STATUS_TEXT = {
  pending:   'This order was never paid. If you were charged, contact us and we will sort it out.',
  confirmed: 'Paid and confirmed — we are packing it.',
  shipped:   'On its way to you.',
  delivered: 'Delivered. Enjoy!',
  cancelled: 'This order was cancelled. If you were charged, we will refund you.'
};

function showNotFound() {
  document.getElementById('orderTitle').textContent = 'Order not found';
  document.getElementById('orderStatus').textContent =
    'This link is incomplete or no longer valid. Use the link from your confirmation email, or contact us.';
}

function render(order) {
  document.getElementById('orderTitle').textContent = 'Order #' + order.id;
  var status = document.getElementById('orderStatus');
  status.innerHTML = '<span class="badge badge--' + escHtml(order.status) + '">' + escHtml(order.status) + '</span><br>' +
    'Placed ' + escHtml(snrOrderTime(order.created_at)) + '<br>' +
    escHtml(STATUS_TEXT[order.status] || '');

  document.getElementById('orderItems').innerHTML = (order.items || []).map(function(item) {
    return '<div class="item">' +
      (item.image ? '<img class="item__img" src="' + escHtml(item.image) + '" alt="">' : '<div class="item__img"></div>') +
      '<div><p class="item__name">' + escHtml(item.product_name) + '</p>' +
      '<p class="item__meta">' + (item.size ? 'Size ' + escHtml(item.size) + ' · ' : '') + 'Qty ' + Number(item.qty) + '</p></div>' +
      '<span class="item__price">' + formatEuro(item.subtotal) + '</span>' +
      '</div>';
  }).join('');

  var shipping = parseFloat(order.shipping || 0);
  document.getElementById('orderSubtotal').textContent = formatEuro(order.subtotal);
  document.getElementById('orderShipping').textContent = shipping > 0 ? formatEuro(shipping) : 'Free';
  document.getElementById('orderTotal').textContent = formatEuro(order.total);
  document.getElementById('orderTotals').style.display = '';

  var address = document.getElementById('orderAddress');
  address.textContent = '';
  [order.full_name, order.address, order.postal_code + ' ' + order.city, order.country].forEach(function(line) {
    address.appendChild(document.createTextNode(line));
    address.appendChild(document.createElement('br'));
  });
  document.getElementById('orderShipTo').style.display = '';
}

async function loadOrder() {
  if (!orderId || !token) return showNotFound();
  try {
    var res = await fetch(API_BASE + '/orders/guest/' + encodeURIComponent(orderId) + '/', {
      headers: {'X-Order-Token': token}
    });
    if (!res.ok) return showNotFound();
    render(await res.json());
  } catch (ex) {
    document.getElementById('orderTitle').textContent = 'Could not load your order';
    document.getElementById('orderStatus').textContent = 'Please check your connection and refresh the page.';
  }
}

loadOrder();
