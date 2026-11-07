import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { asset } from './components';

export default function HomeHero() {
  const section = useRef(null);
  const photo = useRef(null);
  const [photoReady, setPhotoReady] = useState(false);

  useEffect(() => {
    if (photo.current?.complete) setPhotoReady(true);
  }, []);

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const update = () => {
      frame = 0;
      if (!section.current || !photo.current) return;
      const { top, height } = section.current.getBoundingClientRect();
      if (motion.matches) {
        photo.current.style.setProperty('--parallax-y', '0px');
        section.current.style.setProperty('--wave-rise', '0px');
        return;
      }
      if (top > window.innerHeight || top < -height) return;
      const distance = Math.max(0, section.current.offsetTop - top);
      const strength = window.innerWidth <= 700 ? 0.09 : 0.16;
      photo.current.style.setProperty('--parallax-y', `${Math.min(distance * strength, height * 0.2)}px`);
      section.current.style.setProperty('--wave-rise', `${Math.min(distance * 0.18, 90)}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    motion.addEventListener('change', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      motion.removeEventListener('change', schedule);
    };
  }, []);

  return <section ref={section} className="editorial-hero" aria-labelledby="hero-title" data-photo-ready={photoReady ? 'true' : undefined}>
    <div className="editorial-hero-media">
      <picture>
        <source media="(max-width: 700px)" srcSet={asset('generated/scene/hero-syrniki-mobile.jpg')}/>
        <img ref={photo} src={asset('generated/scene/hero-syrniki.jpg')} alt="Румяные сырники со сметаной и ягодами на фарфоровой тарелке с синим узором" fetchPriority="high" width="1672" height="941" onLoad={() => setPhotoReady(true)} onError={() => setPhotoReady(true)}/>
      </picture>
    </div>
    <div className="hero-tide" aria-hidden="true">
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
