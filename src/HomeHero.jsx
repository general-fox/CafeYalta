import { useEffect, useRef, useState } from 'react';
import { Copy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Gulls } from './components';
import { useShop } from './store';
import { HarborIllustration } from './HeroSeaArt';
import { heroPhotoSizes, interiorPhotos, sceneImageProps } from './interiorPhotos';
import { useHomeEntrance } from './HomeEntrance';
import HeroHandwriting from './HeroHandwriting';

const promoCode = 'CAFEYALTA2026';

export default function HomeHero({ gullOrigin }) {
  const { setModal, notify } = useShop();
  const codeText = useRef(null);
  const hero = useRef(null);
  const entrance = useHomeEntrance();
  const [moving, setMoving] = useState(true);
  const [firstShotSettled, setFirstShotSettled] = useState(false);
  const [showFollowingShots, setShowFollowingShots] = useState(false);
  const visualsMoving = moving && entrance.phase === 'done';

  useEffect(() => {
    let onScreen = true;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setMoving(onScreen && !document.hidden && !motion.matches);
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      updateMotion();
    });
    observer.observe(hero.current);
    motion.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateMotion);
    updateMotion();
    return () => {
      observer.disconnect();
      motion.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateMotion);
    };
  }, []);

  useEffect(() => {
    if (firstShotSettled && visualsMoving) setShowFollowingShots(true);
  }, [firstShotSettled, visualsMoving]);

  const finishFirstShot = () => setFirstShotSettled(true);
  const copyPromoCode = async () => {
    entrance.finish();
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

  return <section ref={hero} className="editorial-hero" aria-labelledby="hero-title" data-moving={visualsMoving}>
    <div className="surface-grain" aria-hidden="true"/>
    <div className="hero-art-panel" aria-hidden="true">
      <span ref={gullOrigin} className="gull-origin"><Gulls className="harbor-gulls"/></span>
      <HarborIllustration moving={visualsMoving}/>
    </div>
    <div className="coast-layout hero-content">
      <div className="hero-scenes" aria-hidden="true">
        <div className="hero-scene-reveal">
          {interiorPhotos.slice(0, showFollowingShots ? interiorPhotos.length : 1).map(({ stem, width, height }, index) => (
            <img key={stem} className="hero-scene-shot" {...sceneImageProps(stem, heroPhotoSizes)}
              width={width} height={height} alt="" fetchPriority={index === 0 ? 'high' : 'low'}
              onLoad={index === 0 ? finishFirstShot : undefined} onError={index === 0 ? finishFirstShot : undefined}/>
          ))}
        </div>
      </div>
      <div className="hero-lettering">
        <div className="hero-intro-copy">
          <p className="hero-location">Москва <span className="hero-location-dot" aria-hidden="true">·</span> <span className="hero-neighborhood">ЖК «Испанские кварталы»</span></p>
          <h1 id="hero-title"><HeroHandwriting/></h1>
          <div className="hero-offer">
            <p>При заказе на сайте <span className="offer-discount">скидка на доставку 20 %</span></p>
            <p className="hero-offer-code">по промокоду{' '}
              <button type="button" className="offer-code" onClick={copyPromoCode} aria-label={`Скопировать промокод ${promoCode}`}>
                <span ref={codeText}>{promoCode}</span><Copy size={15} strokeWidth={1.6} aria-hidden="true"/>
              </button>
            </p>
          </div>
        </div>
        <div className="hero-actions">
          <button type="button" className="button hero-booking" onClick={() => { entrance.finish(); setModal('booking'); }}>Забронировать стол</button>
          <Link className="button hero-delivery" to="/delivery" onClick={entrance.finish}>Заказать доставку</Link>
        </div>
      </div>
    </div>
  </section>;
}
