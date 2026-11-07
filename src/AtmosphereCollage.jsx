import { useEffect, useRef } from 'react';
import { asset } from './components';

export default function AtmosphereCollage() {
  const figure = useRef(null);
  const table = useRef(null);
  const main = useRef(null);
  const detail = useRef(null);

  useEffect(() => {
    const element = figure.current;
    const photos = [
      { element: main.current, distance: 16 },
      { element: table.current, distance: 28 },
      { element: detail.current, distance: 36 },
    ];
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let disposed = false;
    let visible = false;
    let frame = 0;
    let previousTime = 0;
    let current = 0;
    let target = 0;
    let scale = 1;
    let needsMeasure = true;

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
      element.removeAttribute('data-motion-active');
    };
    const update = time => {
      frame = 0;
      if (disposed || !visible || motion.matches || document.hidden) { stop(); return; }
      if (needsMeasure) {
        // The figure never translates: child transforms cannot affect progress.
        const { top, height } = element.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        target = Math.max(-1, Math.min(1, (viewportHeight / 2 - top - height / 2) / ((viewportHeight + height) / 2)));
        scale = window.innerWidth <= 700 ? 0.5 : 1;
        needsMeasure = false;
      }
      const elapsed = previousTime ? Math.min(time - previousTime, 64) : 16;
      previousTime = time;
      current += (target - current) * (1 - Math.exp(-elapsed / 110));
      const settled = Math.abs(target - current) < 0.0005;
      if (settled) current = target;
      photos.forEach(photo => photo.element.style.setProperty('--collage-shift', `${(current * photo.distance * scale).toFixed(2)}px`));
      if (settled) stop();
      else frame = requestAnimationFrame(update);
    };
    const schedule = () => {
      needsMeasure = true;
      if (disposed || !visible || motion.matches || document.hidden || frame) return;
      element.setAttribute('data-motion-active', '');
      frame = requestAnimationFrame(update);
    };
    const changeMotion = () => {
      stop();
      current = target = 0;
      photos.forEach(photo => photo.element.style.removeProperty('--collage-shift'));
      if (!motion.matches) schedule();
    };
    const changeVisibility = () => {
      if (document.hidden) stop();
      else schedule();
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (disposed) return;
      visible = entry.isIntersecting;
      if (visible) schedule();
      else stop();
    });
    observer.observe(element);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', changeVisibility);
    motion.addEventListener('change', changeMotion);
    return () => {
      disposed = true;
      stop();
      observer.disconnect();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', changeVisibility);
      motion.removeEventListener('change', changeMotion);
      photos.forEach(photo => photo.element.style.removeProperty('--collage-shift'));
    };
  }, []);

  return <figure ref={figure} className="atmosphere-collage reveal">
    <img ref={table} className="collage-image collage-table" src={asset('generated/scene/interior-table.jpg')} alt="Концепция: столик у окна с синим диваном и бордовым цветком" loading="lazy" width="1086" height="1448"/>
    <img ref={main} className="collage-image collage-main" src={asset('generated/scene/interior-main.jpg')} alt="Концепция зала «Ялты»: солнечный свет, дерево и синие акценты" loading="lazy" width="1448" height="1086"/>
    <img ref={detail} className="collage-image collage-detail" src={asset('generated/scene/interior-detail.jpg')} alt="Концепция кофейного уголка с синей плиткой и тёплым деревом" loading="lazy" width="1086" height="1448"/>
    <figcaption>Образ будущей «Ялты»</figcaption>
  </figure>;
}
