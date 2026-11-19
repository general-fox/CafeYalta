import { useEffect, useRef, useState } from 'react';
import { Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { asset, Gulls } from './components';
import { useShop } from './store';
import { HarborIllustration } from './HeroSeaArt';
import { interiorPhotos } from './interiorPhotos';

const promoCode = 'CAFEYALTA2026';

export default function HomeHero({ gullOrigin }) {
  const { setModal, notify } = useShop();
  const codeText = useRef(null);
  const hero = useRef(null);
  const [moving, setMoving] = useState(true);

  useEffect(() => {
    let onScreen = true;
    const updateMotion = () => setMoving(onScreen && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      updateMotion();
    });
    observer.observe(hero.current);
    document.addEventListener('visibilitychange', updateMotion);
    updateMotion();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', updateMotion);
    };
  }, []);

  const copyPromoCode = async () => {
    try {
      await navigator.clipboard.writeText(promoCode);
      notify('Скопировано');
    } catch {
      if (!codeText.current) return;
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(codeText.current);
      selection.removeAllRanges();
      selection.addRange(range);
      notify('Скопируйте выделенный промокод');
    }
  };

  return <section ref={hero} className="editorial-hero" aria-labelledby="hero-title" data-moving={moving}>
    <div className="surface-grain" aria-hidden="true"/>
    <div className="hero-art-panel" aria-hidden="true">
      <span ref={gullOrigin} className="gull-origin"><Gulls className="harbor-gulls"/></span>
      <HarborIllustration moving={moving}/>
    </div>
    <div className="coast-layout hero-content">
      <div className="hero-scenes" aria-hidden="true">
        {interiorPhotos.map(({ scene, image, width, height, fullWidth }, index) => {
          const compact = asset(`generated/scene/${image}`);
          const full = asset(`generated/scene/interior-${scene}.jpg`);
          return <img key={scene} className="hero-scene-shot" src={compact}
            srcSet={`${compact} ${width}w, ${full} ${fullWidth}w`} sizes="(max-width: 370px) calc(100vw - 40px), (max-width: 700px) calc(100vw - 48px), (max-width: 900px) calc(40vw - 32px), (max-width: 1360px) calc(37.6vw - 32px), 478px"
            width={width} height={height} alt="" fetchPriority={index === 0 ? 'high' : undefined}/>;
        })}
      </div>
      <div className="hero-lettering">
        <div className="hero-intro-copy">
          <p className="hero-location">Москва <span className="hero-location-dot" aria-hidden="true">·</span> <span className="hero-neighborhood">ЖК «Испанские кварталы»</span></p>
          <h1 id="hero-title">Домашняя<br/>кухня</h1>
          <div className="hero-offer">
            <p>При заказе на сайте скидка на доставку 20 %</p>
            <p className="hero-offer-code">по промокоду{' '}
              <button type="button" onClick={copyPromoCode} aria-label={`Скопировать промокод ${promoCode}`}>
                <span ref={codeText}>{promoCode}</span><Copy size={15} strokeWidth={1.6} aria-hidden="true"/>
              </button>
            </p>
          </div>
        </div>
        <div className="hero-actions">
          <button type="button" className="button hero-booking" onClick={() => setModal('booking')}>Забронировать стол</button>
          <Link className="button hero-delivery" to="/delivery">Заказать доставку</Link>
        </div>
      </div>
    </div>
  </section>;
}
