var API_BASE = '/api';

async function apiFetch(path, opts) {
  opts = opts || {};
  var url = API_BASE + path;
  var isFormData = opts.body instanceof FormData;
  var headers = isFormData ? {} : Object.assign({'Content-Type': 'application/json'}, opts.headers || {});
  var token = localStorage.getItem('snr_token');
  if (token) headers['Authorization'] = 'Bearer ' + token;

  var res = await fetch(url, Object.assign({}, opts, {headers: headers}));

  if (res.status === 401) {
    var refresh = localStorage.getItem('snr_refresh');
    if (refresh) {
      var rr = await fetch(API_BASE + '/auth/refresh/', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({refresh: refresh})
      });
      if (rr.ok) {
        var data = await rr.json();
        localStorage.setItem('snr_token', data.access);
        headers['Authorization'] = 'Bearer ' + data.access;
        res = await fetch(url, Object.assign({}, opts, {headers: headers}));
      } else {
        snrLogout(false);
        return null;
      }
    } else {
      snrLogout(false);
      return null;
    }
  }

  return res;
}

function snrLogout(redirect) {
  localStorage.removeItem('snr_token');
  localStorage.removeItem('snr_refresh');
  localStorage.removeItem('snr_is_staff');
  if (redirect !== false) window.location.href = 'index.html';
}

function snrInitNav() {
  if (localStorage.getItem('snr_token')) {
    var l = document.getElementById('headerLogin');
    var m = document.getElementById('accountMenu');
    if (l) l.style.display = 'none';
    if (m) m.style.display = 'flex';
  }
  if (localStorage.getItem('snr_is_staff') === '1') {
    var a = document.getElementById('adminLink');
    if (a) a.style.display = 'block';
  }
  var trigger = document.getElementById('accountTrigger');
  var drop    = document.getElementById('accountDropdown');
  if (trigger && drop) {
    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      drop.classList.toggle('open');
    });
    document.addEventListener('click', function() {
      drop.classList.remove('open');
    });
  }
}
