var params = new URLSearchParams(location.search);
var uid = params.get('uid');
var token = params.get('token');

function showState(name) {
  document.getElementById('stateForm').hidden    = name !== 'form';
  document.getElementById('stateSuccess').hidden = name !== 'success';
  document.getElementById('stateInvalid').hidden = name !== 'invalid';
}

if (!uid || !token) showState('invalid');

// Keep the token out of the address bar (and so out of history and
// Referer headers) once it has been read.
if (uid || token) history.replaceState(null, '', location.pathname);

document.getElementById('resetForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var pass = document.getElementById('pass').value;
  var confirm = document.getElementById('passConfirm').value;
  var btn = document.getElementById('submitBtn');
  var err = document.getElementById('err');
  err.hidden = true;

  if (pass !== confirm) {
    err.textContent = 'Passwords do not match.';
    err.hidden = false;
    return;
  }

  btn.disabled = true;
  try {
    var res = await fetch(API_BASE + '/auth/password-reset/confirm/', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({uid: uid, token: token, password: pass})
    });
    var d = await res.json().catch(function() { return {}; });
    if (res.ok) {
      // Any session this browser had is now revoked server-side.
      localStorage.removeItem('snr_token');
      localStorage.removeItem('snr_refresh');
      showState('success');
    } else if (d.non_field_errors) {
      showState('invalid');
    } else if (res.status === 429) {
      err.textContent = 'Too many attempts. Please wait a while and try again.';
      err.hidden = false;
    } else {
      err.textContent = (d.password && d.password.join(' ')) || d.detail || 'Could not reset your password. Please try again.';
      err.hidden = false;
    }
  } catch (ex) {
    err.textContent = 'Network error. Please try again.';
    err.hidden = false;
  }
  btn.disabled = false;
});
