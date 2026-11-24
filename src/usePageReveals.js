import { useLayoutEffect } from 'react';

const TARGETS = '[data-reveal], .reveal';

// Enhance content only after the observer is ready. Without it everything stays visible.
export default function usePageReveals() {
  useLayoutEffect(() => {
    const root = document.getElementById('root');
    if (!root || !('IntersectionObserver' in window)) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const tracked = new Set();
    const timers = new Map();

    const finish = element => {
      clearTimeout(timers.get(element));
      timers.delete(element);
      element.dataset.revealState = 'revealed';
      element.classList.add('is-visible');
      observer.unobserve(element);
    };
    const observer = new IntersectionObserver(entries => {
      entries.forEach(({ target, isIntersecting, boundingClientRect }) => {
        if (!isIntersecting) {
          if (boundingClientRect.bottom < 0) finish(target);
          return;
        }
        observer.unobserve(target);
        if (motion.matches || target.contains(document.activeElement)) { finish(target); return; }
        target.dataset.revealState = 'entering';
        // Also settle if a browser suppresses animationend (background tab, CSS changes).
        timers.set(target, setTimeout(() => finish(target), 1100));
      });
    }, { threshold: 0.01, rootMargin: '0px 0px -16px 0px' });

    const register = element => {
      if (tracked.has(element)) return;
      // A group enters together or its children do; never compound both movements.
      if (element.parentElement?.closest(TARGETS)) return;
      tracked.add(element);
      const group = element.closest('[data-reveal-group]');
      if (group) {
        const siblings = [...group.querySelectorAll(TARGETS)]
          .filter(item => item.closest('[data-reveal-group]') === group && !item.parentElement?.closest(TARGETS));
        element.style.setProperty('--reveal-delay', `${Math.min(Math.max(siblings.indexOf(element), 0), 3) * 60}ms`);
      }
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
