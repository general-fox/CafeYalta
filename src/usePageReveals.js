import { useLayoutEffect } from 'react';

const TARGETS = '[data-reveal], .reveal';
const STEP_MS = 85;
const MAX_STAGGER_MS = 300;

function readingOrder(a, b) {
  if (a === b) return 0;
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
}

// Enhance content only after the observer is ready. Without it everything stays visible.
export default function usePageReveals() {
  useLayoutEffect(() => {
    const root = document.getElementById('root');
    if (!root || !('IntersectionObserver' in window)) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const tracked = new Set();
    const timers = new Map();
    let lastStart = 0;
    let lastGroup = null;

    const finish = element => {
      clearTimeout(timers.get(element));
      timers.delete(element);
      element.dataset.revealState = 'revealed';
      element.classList.add('is-visible');
      observer.unobserve(element);
    };
    const observer = new IntersectionObserver(entries => {
      const visible = [];
      for (const { target, isIntersecting, boundingClientRect } of entries) {
        if (!target.isConnected || target.dataset.revealState !== 'pending') continue;
        if (!isIntersecting) {
          if (boundingClientRect.bottom < 0) finish(target);
          continue;
        }
        observer.unobserve(target);
        if (motion.matches || target.contains(document.activeElement)) finish(target);
        else visible.push(target);
      }
      if (!visible.length) return;
      visible.sort(readingOrder);

      // Space only the items coming into view. A fast swipe must not build a long queue.
      const sectionSelector = '[data-reveal-group], section, main, footer';
      const now = performance.now();
      const previous = visible[0].closest(sectionSelector) === lastGroup ? lastStart : 0;
      const step = Math.min(STEP_MS, (now + MAX_STAGGER_MS - Math.max(now, previous)) / visible.length);
      let start = Math.max(now, previous + step);
      for (const target of visible) {
        const delay = Math.round(start - now);
        target.style.setProperty('--reveal-delay', delay + 'ms');
        target.dataset.revealState = 'entering';
        // Keep a fallback for browsers that suppress animationend in background tabs.
        timers.set(target, setTimeout(() => finish(target), delay + 900));
        lastStart = start;
        start += step;
      }
      lastGroup = visible[visible.length - 1].closest(sectionSelector);
    }, { threshold: 0, rootMargin: '0px 0px -8px 0px' });

    const register = element => {
      if (tracked.has(element)) return;
      // A group enters together or its children do; never compound both movements.
      if (element.parentElement?.closest(TARGETS)) return;
      tracked.add(element);
      if (motion.matches || element.contains(document.activeElement)) { finish(element); return; }
      element.dataset.revealState = 'pending';
      observer.observe(element);
    };
    const scan = node => {
      if (node.nodeType !== 1) return;
      if (node.matches(TARGETS)) register(node);
      node.querySelectorAll(TARGETS).forEach(register);
    };
    const mutation = new MutationObserver(records => {
      // Only inspect added subtrees; typing and cart updates do not rescan the menu.
      records.forEach(record => record.addedNodes.forEach(scan));
      if (!records.some(record => record.removedNodes.length)) return;
      tracked.forEach(element => {
        if (element.isConnected) return;
        observer.unobserve(element);
        clearTimeout(timers.get(element));
        timers.delete(element);
        tracked.delete(element);
      });
    });
    const onFocus = event => {
      let element = event.target.closest(TARGETS);
      while (element && !tracked.has(element)) element = element.parentElement?.closest(TARGETS);
      if (element) finish(element);
    };
    const onEnd = event => {
      if (event.animationName === 'coastal-reveal' && tracked.has(event.target)) finish(event.target);
    };
    const onMotion = () => {
      if (motion.matches) tracked.forEach(finish);
    };

    scan(root);
    mutation.observe(root, { childList: true, subtree: true });
    root.addEventListener('focusin', onFocus);
    root.addEventListener('animationend', onEnd);
    motion.addEventListener('change', onMotion);
    return () => {
      observer.disconnect();
      mutation.disconnect();
      timers.forEach(clearTimeout);
      root.removeEventListener('focusin', onFocus);
      root.removeEventListener('animationend', onEnd);
      motion.removeEventListener('change', onMotion);
      tracked.forEach(element => {
        delete element.dataset.revealState;
        element.style.removeProperty('--reveal-delay');
      });
    };
  }, []);
}
