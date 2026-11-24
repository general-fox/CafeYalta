import { useLayoutEffect, useRef } from 'react';
import { asset } from './components';
import { aboutInteriors } from './interiorPhotos';
import GullFlight from './GullFlight';
import './about-cafe.css';

const count = aboutInteriors.length;
const slidePause = 2400;
const slideDuration = 950;
// Copies on each end keep the next photo visible during the wraparound.
const slides = [aboutInteriors[count - 1], ...aboutInteriors, ...aboutInteriors.slice(0, 2)];

export default function AboutCafe({ gullOrigin }) {
  const gallery = useRef(null);

  useLayoutEffect(() => {
    const track = gallery.current;
    const cards = track.children;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let inView = false;
    let pointer = null;
    let current = 0;
    let advanceTimer;
    let settleTimer;
    let animationFrame = 0;

    const nearest = () => Math.round(track.scrollLeft / cards[1].offsetLeft);
    const snapTo = index => track.scrollTo({ left: cards[index].offsetLeft, behavior: 'instant' });
    const stopAnimation = () => {
      if (!animationFrame) return;
      cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      track.style.removeProperty('scroll-snap-type');
    };
    const schedule = () => {
      clearTimeout(advanceTimer);
      if (!inView || document.hidden || motion.matches) {
        stopAnimation();
        return;
      }
      if (animationFrame || pointer?.mouse || pointer?.dragging) return;
      advanceTimer = setTimeout(() => move(current + 2), slidePause);
    };
    const settle = () => {
      const slot = nearest();
      current = ((slot - 1) % count + count) % count;
      if (slot !== current + 1) snapTo(current + 1);
      schedule();
    };
    const move = index => {
      stopAnimation();
      clearTimeout(advanceTimer);
      clearTimeout(settleTimer);
      const start = track.scrollLeft;
      const distance = cards[index].offsetLeft - start;
      if (motion.matches || !distance) {
        snapTo(index);
        settle();
        return;
      }
      // During the glide, native snapping would round each intermediate position to a slide.
      track.style.scrollSnapType = 'none';
      const started = performance.now();
      const step = now => {
        const progress = Math.min(1, (now - started) / slideDuration);
        const eased = (1 - Math.cos(Math.PI * progress)) / 2;
        track.scrollTo({ left: start + distance * eased, behavior: 'instant' });
        if (progress < 1) {
          animationFrame = requestAnimationFrame(step);
        } else {
          stopAnimation();
          snapTo(index);
          settle();
        }
      };
      animationFrame = requestAnimationFrame(step);
    };
    const onScroll = () => {
      if (animationFrame || pointer?.dragging) return;
      clearTimeout(advanceTimer);
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, 130);
    };
    const onKeyDown = event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const slot = nearest();
      const next = { ArrowLeft: Math.max(0, slot - 1), ArrowRight: Math.min(cards.length - 1, slot + 1), Home: 1, End: count }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      move(next);
    };
    const onPress = event => {
      if (!event.isPrimary || event.button !== 0) return;
      const mouse = event.pointerType === 'mouse';
      pointer = { id: event.pointerId, mouse, x: event.clientX, y: event.clientY,
        left: track.scrollLeft, slot: nearest(), card: event.target, dragging: false };
      if (mouse) {
        clearTimeout(advanceTimer);
        clearTimeout(settleTimer);
        stopAnimation();
        track.setPointerCapture(event.pointerId);
      }
    };
    const onDrag = event => {
      if (!pointer || event.pointerId !== pointer.id) return;
      const distance = pointer.x - event.clientX;
      if (!pointer.dragging) {
        if (Math.abs(distance) < 5) return;
        if (!pointer.mouse && Math.abs(distance) <= Math.abs(pointer.y - event.clientY)) return;
        pointer.dragging = true;
        if (pointer.mouse) {
          track.setAttribute('data-dragging', '');
        } else {
          clearTimeout(advanceTimer);
          clearTimeout(settleTimer);
          stopAnimation();
        }
      }
      if (pointer.mouse) track.scrollLeft = pointer.left + distance;
    };
    const onRelease = event => {
      if (!pointer || event.pointerId !== pointer.id) return;
      const gesture = pointer;
      pointer = null;
      if (!gesture.mouse) {
        if (gesture.dragging) schedule();
        return;
      }
      let next = nearest();
      if (event.type === 'pointerup') {
        const distance = gesture.x - event.clientX;
        if (gesture.dragging && Math.abs(distance) >= Math.min(64, track.clientWidth * .15)) {
          next = gesture.slot + Math.sign(distance);
        } else if (!gesture.dragging && document.elementFromPoint(event.clientX, event.clientY) === gesture.card) {
          const clicked = Array.prototype.indexOf.call(cards, gesture.card);
          if (clicked >= 0) next = clicked;
        }
      }
      move(Math.max(0, Math.min(count + 1, next)));
      track.removeAttribute('data-dragging');
    };
    const onWheel = event => {
      if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) stopAnimation();
    };
    const visible = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      schedule();
    });
    let slideWidthWithGap = cards[1].offsetLeft;
    const resize = new ResizeObserver(() => {
      // Mobile browser bars resize the photos vertically without changing their snap points.
      const step = cards[1].offsetLeft;
      if (step === slideWidthWithGap) return;
      slideWidthWithGap = step;
      stopAnimation();
      snapTo(current + 1);
      schedule();
    });
    snapTo(1);
    visible.observe(track);
    resize.observe(track);
    track.addEventListener('scroll', onScroll, { passive: true });
    track.addEventListener('keydown', onKeyDown);
    track.addEventListener('pointerdown', onPress);
    track.addEventListener('pointermove', onDrag);
    track.addEventListener('lostpointercapture', onRelease);
    track.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('pointerup', onRelease);
    window.addEventListener('pointercancel', onRelease);
    document.addEventListener('visibilitychange', schedule);
    motion.addEventListener('change', schedule);
    return () => {
      clearTimeout(advanceTimer);
      clearTimeout(settleTimer);
      visible.disconnect();
      resize.disconnect();
      track.removeEventListener('scroll', onScroll);
      track.removeEventListener('keydown', onKeyDown);
      track.removeEventListener('pointerdown', onPress);
      track.removeEventListener('pointermove', onDrag);
      track.removeEventListener('lostpointercapture', onRelease);
      track.removeAttribute('data-dragging');
      track.removeEventListener('wheel', onWheel);
      stopAnimation();
      window.removeEventListener('pointerup', onRelease);
      window.removeEventListener('pointercancel', onRelease);
      document.removeEventListener('visibilitychange', schedule);
      motion.removeEventListener('change', schedule);
    };
  }, []);

  return <section id="about" className="about-section cafe-story" aria-labelledby="cafe-story-title">
    <div className="cafe-story-wave" aria-hidden="true"/>
    <div className="coast-layout cafe-story-layout">
      <div className="cafe-story-copy" data-reveal-group>
        <div className="cafe-story-heading">
          <GullFlight origin={gullOrigin}/>
          <span className="cafe-story-kicker" data-reveal="rise">С ЮЖНЫМ НАСТРОЕНИЕМ</span>
          <h2 id="cafe-story-title" className="cafe-story-title" data-reveal="rise">О кафе «Ялта»</h2>
        </div>
        <div>
          <p data-reveal="rise">Мы создаём «Ялту» для простых радостей: домашней кухни, неспешных разговоров и встреч с близкими.</p>
          <p data-reveal="rise">Пока кафе готовится к открытию, делимся эскизами будущего интерьера. Хотим, чтобы здесь было уютно и за семейным обедом, и за чашкой кофе.</p>
        </div>
      </div>
      <div ref={gallery} className="cafe-story-track" data-reveal="soft" role="region" aria-roledescription="карусель" aria-label="Эскизы будущего интерьера" tabIndex={0} aria-describedby="cafe-story-gallery-help">
        {slides.map((interior, index) => <img key={index} className="cafe-story-photo" src={asset('generated/scene/' + interior.image)}
          alt={index > 0 && index <= count ? interior.alt : ''} width={interior.width} height={interior.height}
          loading="lazy" decoding="async" draggable={false} style={{ objectPosition: interior.position }}/>
        )}
      </div>
      <p id="cafe-story-gallery-help" className="cafe-story-sr-only">Листайте фотографии мышью, свайпом или стрелками на клавиатуре. Чтобы открыть соседнюю фотографию, щёлкните по её видимому краю. Home — первый эскиз, End — последний.</p>
    </div>
  </section>;
}
