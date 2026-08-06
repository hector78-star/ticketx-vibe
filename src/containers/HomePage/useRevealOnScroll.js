import { useEffect, useRef, useState } from 'react';

/**
 * Reveal an element the first time it scrolls into view.
 *
 * Uses IntersectionObserver and a plain class toggle rather than animating on the scroll event.
 * Scroll-linked animation runs work on every frame of every scroll and is the usual reason a
 * "premium" landing page feels sticky on a mid-range laptop; this fires once per element and then
 * gets out of the way. The animation itself is CSS transform + opacity only, both of which the
 * compositor can handle without layout or paint.
 *
 * Reveals are one-way. Re-animating on scroll-back is a novelty the second time and an irritation
 * every time after.
 *
 * Respects prefers-reduced-motion by reporting "already revealed", so the content is simply there.
 * The motion is decoration; the page has to work without it - including when IntersectionObserver
 * is missing, which is why the fallback is visible rather than hidden.
 */
const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const useRevealOnScroll = (options = {}) => {
  const { threshold = 0.15, rootMargin = '0px 0px -10% 0px' } = options;
  const ref = useRef(null);
  // Start revealed during SSR and when the browser cannot observe: content must never be stuck
  // invisible because an enhancement did not run.
  const [revealed, setRevealed] = useState(true);

  useEffect(() => {
    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return undefined;
    }

    const node = ref.current;
    if (!node) {
      return undefined;
    }

    setRevealed(false);
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setRevealed(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold, rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return [ref, revealed];
};

export default useRevealOnScroll;
