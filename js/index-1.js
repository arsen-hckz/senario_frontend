(function () {
  const loggedIn = localStorage.getItem('snr_token');
  const seen     = sessionStorage.getItem('snr_popup_seen');
  if (loggedIn || seen) return;

  const overlay = document.getElementById('nlOverlay');
  const modal   = document.getElementById('nlModal');

  setTimeout(() => overlay.classList.add('visible'), 600);

  function dismiss() {
    overlay.style.opacity = '0';
    overlay.style.pointerEvents = 'none';
    sessionStorage.setItem('snr_popup_seen', '1');
  }

  document.getElementById('nlClose').addEventListener('click', dismiss);
  document.getElementById('nlSkip').addEventListener('click', dismiss);
  overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(); });

  document.getElementById('nlForm').addEventListener('submit', e => {
    e.preventDefault();
    dismiss();
  });
})();
