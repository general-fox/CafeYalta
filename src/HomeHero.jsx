import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { asset } from './components';

export default function HomeHero() {
  const section = useRef(null);
  const photo = useRef(null);
  const tide = useRef(null);
  const [photoReady, setPhotoReady] = useState(false);

  useEffect(() => {
    if (photo.current?.complete) setPhotoReady(true);
  }, []);

  useEffect(() => {
    const element = section.current;
    const image = photo.current;
    const water = tide.current;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let previousTime = 0;
    let needsMeasure = true;
    let disposed = false;
    let photoPosition = 0;
    let wavePosition = 0;
    let photoTarget = 0;
    let waveTarget = 0;

    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      previousTime = 0;
    };
    const update = time => {
      frame = 0;
      if (disposed) return;
      if (motion.matches) {
        photoPosition = wavePosition = 0;
        image.style.setProperty('--parallax-y', '0px');
        water.style.setProperty('--wave-rise', '0px');
        element.setAttribute('data-motion-paused', '');
        stop();
        return;
      }
      if (document.hidden) {
        element.setAttribute('data-motion-paused', '');
        stop();
        return;
      }
      if (needsMeasure) {
        const { top, height } = element.getBoundingClientRect();
        if (top > window.innerHeight || top < -height) {
          element.setAttribute('data-motion-paused', '');
          stop();
          return;
        }
        element.removeAttribute('data-motion-paused');
        const distance = Math.max(0, element.offsetTop - top);
        const mobile = window.innerWidth <= 700;
        photoTarget = Math.min(distance * (mobile ? 0.09 : 0.16), height * 0.2);
        waveTarget = mobile ? Math.min(distance * 0.18, 90) : 0;
        needsMeasure = false;
      }
      // Follow scroll with subpixel transforms, without resizing/repainting the wave.
      const elapsed = previousTime ? Math.min(time - previousTime, 64) : 16;
      previousTime = time;
      const easing = 1 - Math.exp(-elapsed / 95);
      photoPosition += (photoTarget - photoPosition) * easing;
      wavePosition += (waveTarget - wavePosition) * easing;
      const settled = Math.abs(photoTarget - photoPosition) < 0.01 && Math.abs(waveTarget - wavePosition) < 0.01;
      if (settled) {
        photoPosition = photoTarget;
        wavePosition = waveTarget;
      }
      image.style.setProperty('--parallax-y', `${photoPosition.toFixed(3)}px`);
      water.style.setProperty('--wave-rise', `${wavePosition.toFixed(3)}px`);
      if (settled) stop();
      else frame = requestAnimationFrame(update);
    };
    const schedule = () => {
      needsMeasure = true;
      if (!frame && !disposed) frame = requestAnimationFrame(update);
    };
    const changeVisibility = () => {
      if (document.hidden) {
        element.setAttribute('data-motion-paused', '');
        stop();
      } else schedule();
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', changeVisibility);
    motion.addEventListener('change', schedule);
    return () => {
      disposed = true;
      stop();
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', changeVisibility);
      motion.removeEventListener('change', schedule);
      image.style.removeProperty('--parallax-y');
      water.style.removeProperty('--wave-rise');
      element.removeAttribute('data-motion-paused');
    };
  }, []);

  return <section ref={section} className="editorial-hero" aria-labelledby="hero-title" data-photo-ready={photoReady ? 'true' : undefined}>
    <div className="editorial-hero-media">
      <picture>
        <source media="(max-width: 700px)" srcSet={asset('generated/scene/hero-syrniki-mobile.jpg')}/>
        <img ref={photo} src={asset('generated/scene/hero-syrniki.jpg')} alt="Румяные сырники со сметаной и ягодами на фарфоровой тарелке с синим узором" fetchPriority="high" width="1672" height="941" onLoad={() => setPhotoReady(true)} onError={() => setPhotoReady(true)}/>
      </picture>
    </div>
    <div ref={tide} className="hero-tide" aria-hidden="true">
      <svg className="hero-tide-trace" viewBox="0 0 2880 160" preserveAspectRatio="none" fill="none">
        <path className="hero-tide-line" d="M0 49Q360 5 720 49T1440 49T2160 49T2880 49"/>
      </svg>
      <svg className="hero-tide-water" viewBox="0 0 2880 160" preserveAspectRatio="none" fill="none">
        <path className="hero-tide-fill" d="M0 65Q360 16 720 65T1440 65T2160 65T2880 65V160H0Z"/>
      </svg>
    </div>
    <div className="editorial-hero-content">
      <div>
        <p className="editorial-hero-kicker">МОСКВА · ПОКРОВКА, 27</p>
        <h1 id="hero-title">Море<br/><em>рядом</em></h1>
      </div>
      <div className="editorial-hero-bottom">
        <div className="hero-promotion"><span>К ВАШЕМУ ЗАКАЗУ</span><p>Морс в подарок<br/>к доставке от 2 000 ₽</p><small>Демоакция</small></div>
        <Link className="button" to="/delivery">Заказать доставку <ArrowUpRight size={21}/></Link>
      </div>
    </div>
  </section>;
}
