var params = new URLSearchParams(location.search);
if (params.get('email')) document.getElementById('email').value = params.get('email');

document.getElementById('forgotForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var email = document.getElementById('email').value.trim();
  var btn = document.getElementById('submitBtn');
  var err = document.getElementById('err');
  err.hidden = true;
  btn.disabled = true;
  try {
    var res = await fetch(API_BASE + '/auth/password-reset/', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: email})
    });
    if (res.status === 429) {
      err.textContent = 'Too many requests. Please wait a while and try again.';
      err.hidden = false;
    } else if (!res.ok) {
      err.textContent = 'Please enter a valid email address.';
      err.hidden = false;
    } else {
      document.getElementById('sentTo').textContent = email;
      document.getElementById('stateForm').hidden = true;
      document.getElementById('stateSent').hidden = false;
    }
  } catch (ex) {
    err.textContent = 'Network error. Please try again.';
    err.hidden = false;
  }
  btn.disabled = false;
});
