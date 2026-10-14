gsap.registerPlugin(ScrollTrigger);

gsap.to('.hero-statement', {
  opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: 0.1
});

['.process-strip', '.bleed-quote', '.pillars', '.manifesto'].forEach(sel => {
  document.querySelectorAll(sel).forEach(el => {
    gsap.to(el, {
      opacity: 1, duration: 0.9, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 85%' }
    });
  });
});
