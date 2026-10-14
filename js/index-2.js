gsap.registerPlugin(ScrollTrigger);

/* logo entrance */
gsap.to('.site-header__logo', {
  opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', delay: 0.1
});

/* each grid cell enters from a unique direction — called after the
   photo grid is rendered from moodboard data, since cells don't exist
   in the static markup anymore */
const dirs = [
  { x: -50, y:   0 },
  { x:   0, y:  40 },
  { x:  50, y:   0 },
  { x: -40, y:  35 },
  { x:   0, y:  50 },
  { x:  40, y:  35 },
  { x: -50, y:   0 },
  { x:   0, y: -35 },
  { x:  50, y:   0 },
  { x: -35, y:  40 },
  { x:  35, y:  40 },
];

function animateGridCells() {
  document.querySelectorAll('.grid-cell').forEach((cell, i) => {
    const d = dirs[i % dirs.length];
    gsap.fromTo(cell,
      { opacity: 0, x: d.x, y: d.y },
      {
        opacity: 1, x: 0, y: 0,
        duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: cell, start: 'top 90%' }
      }
    );
  });
}

/* images shift layout as they load, which can leave ScrollTrigger
   start positions stale (esp. the tall mobile carousel) */
window.addEventListener('load', () => ScrollTrigger.refresh());

/* footer brand */
gsap.to('.footer__logo', {
  opacity: 1, y: 0, duration: 0.9, ease: 'power3.out',
  scrollTrigger: { trigger: '.site-footer', start: 'top 85%' }
});
