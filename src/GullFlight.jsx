import { useLayoutEffect, useRef } from 'react';
import { Gulls } from './components';

const defaultLegDuration = 1400;
const mobileForwardLegDuration = 1200;

export default function GullFlight({ origin }) {
  const arrival = useRef(null);

  useLayoutEffect(() => {
    const start = origin.current;
    const end = arrival.current;
    const heroBirds = start.querySelector('.harbor-gulls');
    const aboutBirds = end.querySelector('.gull-flight');
    const story = end.closest('section');
    const header = document.querySelector('.site-header');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const phone = window.matchMedia('(max-width: 700px)');
    let lastScroll = Math.max(0, window.scrollY);
    let towardAbout = lastScroll > 0;
    // 0 is the hero perch, 1 is offscreen on both sides, and 2 is the About perch.
    let position = 0;
    let target = 0;
    let exitDistance = 0;
    let entryDistance = 0;
    let frame = 0;
    let lastTime = null;

    const paint = () => {
      const exit = Math.min(position, 1) ** 2;
      const entry = Math.min(2 - position, 1) ** 2;
      heroBirds.style.transform = `translate3d(${exitDistance * exit}px, ${-16 * exit}px, 0)`;
      aboutBirds.style.transform = `translate3d(${entryDistance * entry}px, ${12 * entry}px, 0)`;
      heroBirds.style.visibility = position < 1 ? 'visible' : 'hidden';
      aboutBirds.style.visibility = position > 1 ? 'visible' : 'hidden';
      start.toggleAttribute('data-flying', position > 0 && position < 1);
      end.toggleAttribute('data-flying', position > 1 && position < 2);
    };

    const tick = now => {
      const legDuration = phone.matches && target > position ? mobileForwardLegDuration : defaultLegDuration;
      const step = lastTime === null ? 0 : (now - lastTime) / legDuration;
      position = position < target ? Math.min(target, position + step) : Math.max(target, position - step);
      paint();
      lastTime = position === target ? null : now;
      frame = position === target ? 0 : requestAnimationFrame(tick);
    };

    const update = () => {
      const a = start.getBoundingClientRect();
      const b = end.getBoundingClientRect();
      const viewport = document.documentElement;
      exitDistance = viewport.clientWidth - a.left + 16;
      entryDistance = -b.right - 16;

      const headerBottom = Math.max(0, header.getBoundingClientRect().bottom);
      const storyRect = story.getBoundingClientRect();
      const availableHeight = Math.max(0, viewport.clientHeight - headerBottom);
      // The flock stays with About past this line, including on the way back from below.
      const holdInStory = storyRect.top <= viewport.clientHeight - Math.min(storyRect.height, availableHeight) / 2;

      if (motion.matches) {
        cancelAnimationFrame(frame);
        frame = 0;
        lastTime = null;
        position = target = holdInStory ? 2 : 0;
        paint();
        return;
      }

      if (holdInStory) {
        target = 2;
      } else if (towardAbout) {
        const aboutReached = b.top + b.height * .4 <= viewport.clientHeight;
        target = aboutReached || position > 1 ? 2 : 1;
      } else {
        const heroBirdY = a.top + a.height * .5;
        const heroExposed = heroBirdY > headerBottom && heroBirdY < Math.min(viewport.clientHeight, storyRect.top);
        target = heroExposed || lastScroll === 0 || position < 1 ? 0 : 1;
      }
      paint();
      if (position !== target && !frame) frame = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      const viewport = document.documentElement;
      const y = Math.max(0, Math.min(window.scrollY, viewport.scrollHeight - viewport.clientHeight));
      if (y === lastScroll) return;
      towardAbout = y > lastScroll;
      lastScroll = y;
      update();
    };

    const resize = new ResizeObserver(update);
    [start, end, story, header].forEach(node => resize.observe(node));
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);
    motion.addEventListener('change', update);
    update();

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
      motion.removeEventListener('change', update);
      start.removeAttribute('data-flying');
      end.removeAttribute('data-flying');
      heroBirds.removeAttribute('style');
      aboutBirds.removeAttribute('style');
    };
  }, [origin]);

  return <span ref={arrival} className="gull-arrival" aria-hidden="true">
    <span className="gull-flight"><Gulls className="harbor-gulls"/></span>
  </span>;
}
