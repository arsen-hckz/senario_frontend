gsap.registerPlugin(ScrollTrigger);

/* The hero fades in from concept-2.js once the edited texts have loaded. */

['.process-strip', '.bleed-quote', '.pillars'].forEach(sel => {
  document.querySelectorAll(sel).forEach(el => {
    gsap.to(el, {
      opacity: 1, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 85%' }
    });
  });
});
