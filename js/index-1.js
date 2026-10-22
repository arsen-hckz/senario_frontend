// Welcome popup on the moodboard: once per browser session, not for signed-in
// visitors. It only shows the photo and links; there is no form.
(function () {
  const loggedIn = localStorage.getItem('snr_token');
  const seen     = sessionStorage.getItem('snr_popup_seen');
  if (loggedIn || seen) return;

  const overlay = document.getElementById('nlOverlay');

  setTimeout(() => overlay.classList.add('visible'), 600);

  function dismiss() {
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    sessionStorage.setItem('snr_popup_seen', '1');
  }

  document.getElementById('nlClose').addEventListener('click', dismiss);
  document.getElementById('nlSkip').addEventListener('click', dismiss);
  overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(); });
  overlay.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    sessionStorage.setItem('snr_popup_seen', '1');
  }));
})();
