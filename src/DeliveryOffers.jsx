import { useRef, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { asset } from './components';
import FoodImage from './FoodImage';
import { products } from './data';

const offers = [
  { id: 'gift', title: 'Морс в подарок', condition: 'К доставке от 2 000 ₽', category: 'hot' },
  { id: 'delivery', title: 'Доставка за наш счёт', condition: 'При заказе от 2 500 ₽', category: 'hot' },
];
const gift = products.find(product => product.id === 'dr2');

export default function DeliveryOffers({ onChoose }) {
  const [current, setCurrent] = useState(0);
  const touchStart = useRef(null);
  const offer = offers[current];
  const move = direction => setCurrent(index => (index + direction + offers.length) % offers.length);

  return <section className="delivery-offers" aria-label="Предложения для доставки" aria-roledescription="карусель">
    <div className={`offer-slide offer-slide-${offer.id}`} key={offer.id}
      onTouchStart={event => { touchStart.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={event => {
        if (touchStart.current === null) return;
        const distance = event.changedTouches[0].clientX - touchStart.current;
        if (Math.abs(distance) > 45) move(distance < 0 ? 1 : -1);
        touchStart.current = null;
      }}>
      <div className="offer-photo" aria-hidden="true">
        {offer.id === 'gift' ? <FoodImage product={gift} alt="" loading="eager"/> : <img src={asset('scene/hero.jpg')} alt=""/>}
      </div>
      <div className="offer-copy" aria-live="polite">
        <h2>{offer.title}</h2>
        <p>{offer.condition}</p>
        <button className="text-link" onClick={() => onChoose(offer.category)}>Выбрать блюда <ArrowUpRight size={18}/></button>
      </div>
    </div>
    <div className="offer-controls">
      <span className="offer-demo-label">Демоакции</span>
      <div className="offer-dots" aria-label="Выбор акции">{offers.map((item, index) => <button key={item.id} aria-label={`Показать акцию: ${item.title}`} aria-pressed={index === current} onClick={() => setCurrent(index)}><span/></button>)}</div>
      <div className="offer-arrows"><button onClick={() => move(-1)} aria-label="Предыдущая акция"><ChevronLeft size={20}/></button><button onClick={() => move(1)} aria-label="Следующая акция"><ChevronRight size={20}/></button></div>
    </div>
  </section>;
}
