if (!localStorage.getItem('snr_token')) window.location.href = 'login.html';

function loadPrefs() {
  var prefs = JSON.parse(localStorage.getItem('snr_prefs') || '{}');
  ['pref_orders','pref_drops','pref_restocks','pref_editorial'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el && prefs[id] !== undefined) el.checked = prefs[id];
  });
  if (prefs.size) {
    document.querySelectorAll('.size-btn').forEach(function(b) {
      b.classList.toggle('selected', b.dataset.size === prefs.size);
    });
  }
  if (prefs.currency) document.getElementById('prefCurrency').value = prefs.currency;
  if (prefs.addrName)   document.getElementById('addrName').value   = prefs.addrName;
  if (prefs.addrStreet) document.getElementById('addrStreet').value = prefs.addrStreet;
  if (prefs.addrCity)   document.getElementById('addrCity').value   = prefs.addrCity;
  if (prefs.addrPostal) document.getElementById('addrPostal').value = prefs.addrPostal;
  if (prefs.addrCountry) document.getElementById('addrCountry').value = prefs.addrCountry;
}

document.querySelectorAll('.size-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.size-btn').forEach(function(b) { b.classList.remove('selected'); });
    btn.classList.add('selected');
  });
});

function savePrefs() {
  var prefs = JSON.parse(localStorage.getItem('snr_prefs') || '{}');
  ['pref_orders','pref_drops','pref_restocks','pref_editorial'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) prefs[id] = el.checked;
  });
  var sel = document.querySelector('.size-btn.selected');
  if (sel) prefs.size = sel.dataset.size;
  prefs.currency   = document.getElementById('prefCurrency').value;
  prefs.addrName   = document.getElementById('addrName').value.trim();
  prefs.addrStreet = document.getElementById('addrStreet').value.trim();
  prefs.addrCity   = document.getElementById('addrCity').value.trim();
  prefs.addrPostal = document.getElementById('addrPostal').value.trim();
  prefs.addrCountry= document.getElementById('addrCountry').value;
  localStorage.setItem('snr_prefs', JSON.stringify(prefs));
  var msg = document.getElementById('saveMsg');
  msg.style.display = 'block';
  setTimeout(function() { msg.style.display = 'none'; }, 2200);
}

// An older version of this page "changed" the password only in this
// browser, storing it here in plain text. Remove any copy it left.
localStorage.removeItem('snr_password');

async function savePassword() {
  var cur     = document.getElementById('pwCurrent').value;
  var nw      = document.getElementById('pwNew').value;
  var confirm = document.getElementById('pwConfirm').value;
  var msg     = document.getElementById('pwMsg');
  function show(text, ok) {
    msg.textContent = text;
    msg.className = 'section-msg section-msg--' + (ok ? 'ok' : 'err');
    msg.style.display = '';
  }
  if (!cur) return show('Enter your current password.', false);
  if (nw.length < 8) return show('New password must be at least 8 characters.', false);
  if (nw !== confirm) return show('Passwords do not match.', false);

  try {
    var res = await apiFetch('/auth/password-change/', {
      method: 'POST',
      body: JSON.stringify({current_password: cur, new_password: nw})
    });
    if (!res) return;  // signed out: apiFetch already cleared the session
    var data = await res.json().catch(function() { return {}; });
    if (res.status === 429) return show('Too many attempts. Please wait a minute and try again.', false);
    if (!res.ok) {
      var errors = [].concat(data.current_password || [], data.new_password || [], data.detail || []);
      return show(errors.join(' ') || 'Could not change your password.', false);
    }
    // Every other device is now signed out; keep this one signed in.
    localStorage.setItem('snr_token', data.access);
    localStorage.setItem('snr_refresh', data.refresh);
    document.getElementById('pwCurrent').value = '';
    document.getElementById('pwNew').value = '';
    document.getElementById('pwConfirm').value = '';
    show('Password updated. Other devices have been signed out.', true);
  } catch (ex) {
    show('Network error. Please try again.', false);
  }
}

loadPrefs();

snrInitNav();
function logout() { snrLogout(); }

/* Handlers for this page's data-click / data-change / data-submit
   attributes (see actions.js). */
snrOn('click', 'logout', function (el, event) { logout(); });
snrOn('click', 'savePassword', function (el, event) { savePassword(); });
snrOn('click', 'savePrefs', function (el, event) { savePrefs(); });
