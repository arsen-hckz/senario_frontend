var stateChecking = document.getElementById('stateChecking');
var stateSuccess  = document.getElementById('stateSuccess');
var stateError    = document.getElementById('stateError');

function showState(state) {
  stateChecking.hidden = state !== 'checking';
  stateSuccess.hidden  = state !== 'success';
  stateError.hidden    = state !== 'error';
}

(async function verify() {
  var params = new URLSearchParams(location.search);
  var token = params.get('token');

  if (!token) {
    showState('error');
    return;
  }

  try {
    var res = await fetch(API_BASE + '/auth/verify-email/' + encodeURIComponent(token) + '/');
    if (res.ok) {
      showState('success');
    } else {
      showState('error');
    }
  } catch (ex) {
    showState('error');
  }
})();

document.getElementById('resendForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  var email = document.getElementById('resendEmail').value.trim();
  var msg = document.getElementById('resendMsg');
  msg.style.display = 'none';
  try {
    await fetch(API_BASE + '/auth/resend-verification/', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({email: email})
    });
  } catch (ex) {}
  msg.textContent = 'If that email is registered and unverified, a new link is on its way.';
  msg.style.display = 'block';
});
