'use client';

import { useEffect } from 'react';

/* Adds light scroll reveal to marked blocks. Content stays visible without JS or with reduced motion. */
export function RevealObserver() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>('.content-section, .site-callout-inner, .editorial-item, .category-disclosure, .project-row, .case-step, .resume-public'));
    const io = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('is-in'); io.unobserve(entry.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
    els.forEach(el => { if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add('reveal'); io.observe(el); } });
    return () => io.disconnect();
  }, []);
  return null;
}
