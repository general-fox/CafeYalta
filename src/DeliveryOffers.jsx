import { ArrowUpRight } from 'lucide-react';
import { asset } from './components';

export default function DeliveryOffers({ onChoose }) {
  return <section className="delivery-promo" aria-label="Акция для доставки">
    <div className="delivery-promo-copy">
      <span className="delivery-promo-label">При заказе на сайте</span>
      <h2>Скидка 20% на доставку</h2>
      <p className="delivery-promo-code">Промокод <strong>CAFEYALTA2026</strong></p>
      <button type="button" className="text-link" onClick={() => onChoose('breakfast')}>
        Выбрать блюда <ArrowUpRight size={17} aria-hidden="true"/>
      </button>
      <span className="delivery-promo-note">Демоакция</span>
    </div>
    <img className="delivery-promo-image" src={asset('generated/scene/hero-syrniki.jpg')} alt="Сырники со сметаной и ягодами" width="1672" height="941"/>
  </section>;
}
