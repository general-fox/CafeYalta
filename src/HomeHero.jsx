import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { asset } from './components';

export default function HomeHero() {
  const section = useRef(null);
  const photo = useRef(null);

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

  return <section ref={section} className="editorial-hero" aria-labelledby="hero-title">
    <div className="editorial-hero-media">
      <img ref={photo} src={asset('generated/scene/hero-syrniki.jpg')} alt="Румяные сырники со сметаной и ягодами на фарфоровой тарелке с синим узором" fetchPriority="high" width="1672" height="941"/>
    </div>
    <div className="hero-tide" aria-hidden="true">
      <svg viewBox="0 0 1440 160" preserveAspectRatio="none" fill="none">
        <path className="hero-tide-line" d="M0 49C240 4 360 89 660 54S1110 4 1440 59"/>
        <path className="hero-tide-fill" d="M0 65C240 20 360 105 660 70S1110 20 1440 75V160H0Z"/>
      </svg>
    </div>
    <div className="editorial-hero-content">
      <div>
        <p className="editorial-hero-kicker">КАФЕ «ЯЛТА» · МОСКВА</p>
        <h1 id="hero-title">Море<br/><em>рядом.</em></h1>
      </div>
      <div className="editorial-hero-bottom">
        <p>Домашняя кухня.<br/>С южным характером.</p>
        <Link className="button" to="/delivery">Заказать доставку <ArrowUpRight size={21}/></Link>
      </div>
    </div>
  </section>;
}
