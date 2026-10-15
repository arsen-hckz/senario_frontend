snrInitNav();
function logout() { snrLogout(); }

function loginCheckout() {
  window.location.href = 'login?next=checkout';
}

function startCheckout() {
  document.getElementById('authGate').style.display = 'none';
  document.getElementById('checkoutLayout').style.display = 'grid';
  loadCartSummary();
  prefillEmail();
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

if (localStorage.getItem('snr_token')) {
  startCheckout();
}

async function loadCartSummary() {
  try {
    var res = await apiFetch('/cart/');
    if (!res || !res.ok) return;
    var cart = await res.json();
    var container = document.querySelector('.order-summary');
    if (!container || !cart.items || !cart.items.length) return;

    var existingItems = container.querySelectorAll('.summary-item');
    existingItems.forEach(function(el) { el.remove(); });
    var totalsEl = container.querySelector('.summary-totals');

    cart.items.forEach(function(item) {
      var price = parseFloat(item.product.effective_price || item.product.price);
      var size  = item.variant ? item.variant.size : '';
      var safeName = escHtml(item.product.name);
      var safeSize = escHtml(size);
      var div   = document.createElement('div');
      div.className = 'summary-item';
      div.innerHTML =
        '<img class="summary-item__img" src="' + (item.product.image || '') + '" alt="' + safeName + '">' +
        '<div class="summary-item__info">' +
          '<p class="summary-item__name">' + safeName + '</p>' +
          '<p class="summary-item__meta">' + (size ? 'Size: ' + safeSize + ' — ' : '') + 'Qty: ' + item.qty + '</p>' +
        '</div>' +
        '<span class="summary-item__price">' + formatEuro(price * item.qty) + '</span>';
      container.insertBefore(div, totalsEl);
    });

    var total = parseFloat(cart.total || 0);
    var rows = totalsEl ? totalsEl.querySelectorAll('.summary-row') : [];
    if (rows.length >= 3) {
      rows[0].lastElementChild.textContent = '' + formatEuro(total);
      rows[2].lastElementChild.textContent = '' + formatEuro(total);
    }
  } catch (ex) {}
}

/* Order creation and payment are separate steps against the API. We keep
   the created order id in memory so a failed/retried "start payment"
   call never creates a second order behind the customer's back. */
var createdOrderId = null;

document.querySelector('.btn-place-order').addEventListener('click', async function() {
  if (!localStorage.getItem('snr_token')) {
    window.location.href = 'login?next=checkout';
    return;
  }
  var btn = this;

  if (createdOrderId) {
    btn.textContent = 'Redirecting to payment...';
    btn.disabled = true;
    var retryError = await snrStartPayment(createdOrderId);
    if (retryError) {
      alert(retryError);
      btn.textContent = 'Retry Payment';
      btn.disabled = false;
    }
    return;
  }

  var inputs = document.querySelectorAll('.checkout-form input, .checkout-form select');
  var vals = {};
  inputs.forEach(function(el) {
    var lbl = el.previousElementSibling;
    if (lbl) vals[lbl.textContent.trim()] = el.value.trim();
  });

  var firstName  = vals['First Name'] || '';
  var lastName   = vals['Last Name']  || '';
  var address    = vals['Address']    || '';
  var city       = vals['City']       || '';
  var postal     = vals['Postal Code']|| '';
  var email      = vals['Email']      || '';
  var phone      = vals['Phone']      || '';
  var countryEl  = document.querySelector('.checkout-form select');
  var country    = countryEl ? countryEl.value : 'Greece';

  if (!firstName || !phone || !address || !city || !postal) {
    alert('Please fill in your name, phone and shipping address.');
    return;
  }

  btn.textContent = 'Placing order...';
  btn.disabled = true;

  try {
    var res = await apiFetch('/orders/create/', {
      method: 'POST',
      body: JSON.stringify({
        full_name:   firstName + ' ' + lastName,
        email:       email,
        phone:       phone,
        address:     address,
        city:        city,
        country:     country,
        postal_code: postal
      })
    });
    if (res && res.ok) {
      var order = await res.json();
      createdOrderId = order.id;
      btn.textContent = 'Redirecting to payment...';
      var startError = await snrStartPayment(order.id);
      if (startError) {
        alert('Your order #' + order.id + ' is saved, but payment could not start: ' + startError +
              ' You can retry here or from My Orders.');
        btn.textContent = 'Retry Payment';
        btn.disabled = false;
      }
    } else {
      var err = res ? await res.json() : {};
      var msg = Object.values(err).flat().join(' ') || 'Order failed. Please try again.';
      alert(msg);
      btn.textContent = 'Place Order';
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
