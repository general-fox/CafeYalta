import { asset, Waves } from './components';
import './guest-card.css';

export default function GuestCard() {
  return <div className="guest-card-sample" style={{ '--guest-ornament': `url(${asset('brand/olive-border.svg')})` }}>
    <div className="guest-card-label"><span>КАРТА ГОСТЯ</span><Waves/></div>
    <img className="guest-card-wordmark" src={asset('brand/Yalta.svg')} alt="Ялта" width="317" height="99"/>
    <div className="guest-card-details"><span>Всегда рады вам</span><span>Демо</span></div>
  </div>;
}
