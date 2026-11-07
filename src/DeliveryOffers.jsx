import { ArrowUpRight } from 'lucide-react';
import { asset, Waves } from './components';

export default function DeliveryOffers({ onChoose }) {
  return <section className="delivery-promo" aria-label="Акция для доставки">
    <div className="delivery-promo-copy">
      <span className="delivery-promo-label">К ВАШЕМУ ЗАКАЗУ</span>
      <h2>Морс<br/><em>в подарок</em></h2>
      <p>К доставке от 2 000 ₽</p>
      <button className="text-link" onClick={() => onChoose('hot')}>Выбрать блюда <ArrowUpRight size={18}/></button>
      <Waves/>
      <span className="delivery-promo-note">Демоакция</span>
    </div>
    <img className="delivery-promo-image" src={asset('scene/hero.jpg')} alt="Блюда к домашнему обеду"/>
  </section>;
}
