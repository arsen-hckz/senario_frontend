function switchTab(tab) {
  var isLogin = tab === 'login';
  document.getElementById('tabLogin').classList.toggle('active', isLogin);
  document.getElementById('tabRegister').classList.toggle('active', !isLogin);
  document.getElementById('panelLogin').style.display    = isLogin ? 'block' : 'none';
  document.getElementById('panelRegister').style.display = isLogin ? 'none'  : 'block';
}

/* Where to go after signing in. Only a page of this site, like
   "product.html?slug=tee": a link with ?next=javascript:... or
   ?next=https://evil.example would otherwise run code here, with the
   fresh tokens in localStorage, or send the customer off-site. */
function safeNext(next) {
  return /^[A-Za-z0-9_-]+\.html(\?[^#\s]*)?$/.test(next || '') ? next : 'index.html';
}

async function handleLogin(e) {
  e.preventDefault();
  var email  = document.getElementById('loginEmail').value.trim();
  var pass   = document.getElementById('loginPass').value;
  var err    = document.getElementById('loginErr');
  var resend = document.getElementById('loginResend');
  err.style.display = 'none';
  resend.style.display = 'none';
  try {
    var res = await fetch(API_BASE + '/auth/login/', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: email, password: pass})
    });
    if (!res.ok) {
      var d = await res.json();
      err.textContent = d.detail || 'Invalid email or password.';
      err.style.display = 'block';
      if (d.detail && d.detail.toLowerCase().indexOf('verify') !== -1) {
        resend.style.display = 'block';
      }
      return;
    }
    var data = await res.json();
    localStorage.setItem('snr_token', data.access);
    localStorage.setItem('snr_refresh', data.refresh);
    var pr = await fetch(API_BASE + '/auth/profile/', {
      headers: {'Authorization': 'Bearer ' + data.access}
    });
    if (pr.ok) {
      var user = await pr.json();
      if (user.is_staff) localStorage.setItem('snr_is_staff', '1');
      else localStorage.removeItem('snr_is_staff');
    }
    window.location.href = safeNext(new URLSearchParams(location.search).get('next'));
  } catch (ex) {
    err.textContent = 'Network error. Please try again.';
    err.style.display = 'block';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  var name    = document.getElementById('regName').value.trim();
  var email   = document.getElementById('regEmail').value.trim();
  var pass    = document.getElementById('regPass').value;
  var confirm = document.getElementById('regPassConfirm').value;
  var err     = document.getElementById('regErr');
  err.style.display = 'none';
  if (pass !== confirm) {
    document.getElementById('regPassConfirm').style.borderBottomColor = '#c0392b';
    err.textContent = 'Passwords do not match.';
    err.style.display = 'block';
    return;
  }
  var parts = name.split(' ');
  var firstName = parts[0] || '';
  var lastName  = parts.slice(1).join(' ') || '';
  try {
    var res = await fetch(API_BASE + '/auth/register/', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: email, password: pass, first_name: firstName, last_name: lastName})
    });
    if (!res.ok) {
      var d = await res.json();
      var msg = Object.values(d).flat().join(' ');
      err.textContent = msg || 'Registration failed.';
      err.style.display = 'block';
      return;
    }
    document.getElementById('regFormWrap').style.display = 'none';
    document.getElementById('regDoneEmail').textContent = email;
    document.getElementById('regDone').style.display = 'block';
  } catch (ex) {
    err.textContent = 'Network error. Please try again.';
    err.style.display = 'block';
  }
}

async function handleResend() {
  var email = document.getElementById('loginEmail').value.trim();
  var resend = document.getElementById('loginResend');
  if (!email) return;
  resend.querySelector('button').textContent = 'Sending…';
  try {
    await fetch(API_BASE + '/auth/resend-verification/', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: email})
    });
  } catch (ex) {}
  resend.querySelector('button').textContent = 'Sent — check your inbox';
}

function togglePass(id, btn) {
  var input = document.getElementById(id);
  var show  = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.textContent = show ? 'Hide' : 'Show';
}

// Carry over whatever was typed in the email field to the reset page.
document.getElementById('forgotLink').addEventListener('click', function() {
  var email = document.getElementById('loginEmail').value.trim();
  this.href = 'forgot-password.html' + (email ? '?email=' + encodeURIComponent(email) : '');
});

if (new URLSearchParams(location.search).get('tab') === 'register') {
  switchTab('register');
}

/* Handlers for this page's data-click / data-change / data-submit
   attributes (see actions.js). */
snrOn('click', 'switchTab', function (el, event) { switchTab(el.dataset.tab); });
snrOn('submit', 'handleLogin', function (el, event) { handleLogin(event); });
snrOn('submit', 'handleRegister', function (el, event) { handleRegister(event); });
snrOn('click', 'togglePass', function (el, event) { togglePass(el.dataset.target, el); });
snrOn('click', 'handleResend', function (el, event) { handleResend(); });
