if (!localStorage.getItem('snr_token')) window.location.href = 'login';

// An earlier prototype of this page kept demo "saved cards" and wallet
// toggles in the browser; clear them out of returning customers' storage.
localStorage.removeItem('snr_cards');
localStorage.removeItem('snr_wallets');

snrInitNav();
function logout() { snrLogout(); }

/* Handlers for this page's data-click / data-change / data-submit
   attributes (see actions.js). */
snrOn('click', 'logout', function (el, event) { logout(); });
