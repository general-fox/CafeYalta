import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowUpRight, Check, ClipboardList, MessageSquare, Plus, QrCode, WalletCards } from 'lucide-react';
import { useShop } from '../store';
import { asset, Waves } from '../components';
import './secondary.css';
import './loyalty-brand.css';

const registrationSteps = [
  { title: 'Откройте регистрацию', text: 'Перейдите по ссылке или отсканируйте QR-код в кафе.', Icon: QrCode },
  { title: 'Подтвердите телефон', text: 'Введите свой номер и проверочный код из SMS.', Icon: MessageSquare },
  { title: 'Заполните анкету', text: 'Укажите данные в полях, отмеченных звёздочкой.', Icon: ClipboardList },
  { title: 'Сохраните карту', text: 'На экране карты нажмите «Добавить» справа вверху.', Icon: WalletCards },
];

function GuestCard() {
  return <div className="lb-card" aria-label="Образец электронной карты Ялты">
    <div className="lb-card-top"><span>КАРТА ГОСТЯ</span><Waves/></div>
    <img src={asset('brand/Yalta-white.svg')} alt="Ялта"/>
    <div className="lb-card-bottom"><span>Всегда рады вам</span><span>Демо</span></div>
  </div>;
}

export default function Loyalty() {
  const { user, setUser, notify, openAuth } = useShop();
  const [consent, setConsent] = useState(false);

  function register(event) {
    event.preventDefault();
    if (!user) return openAuth();
    if (!consent) return;
    setUser({ ...user, loyaltyRequested: true });
    notify('Тестовая заявка сохранена. Настоящая карта пока не выпускается.');
  }

  function scrollToRegistration(event) {
    event.preventDefault();
    document.getElementById('get-card')?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }

  return <main className="loyalty-page loyalty-brand">
    <section className="container lb-intro">
      <div className="lb-intro-copy">
        <span className="lb-kicker">ПРОГРАММА ЛОЯЛЬНОСТИ</span>
        <h1>Хорошо быть<br/><em>своим</em></h1>
        <p>Любимые блюда, тёплые встречи<br/>и чуть больше внимания нашим гостям.</p>
        <a className="button" href="#get-card" onClick={scrollToRegistration}>Стать гостем Ялты <ArrowDownRight size={20} aria-hidden="true"/></a>
      </div>
      <aside className="lb-card-preview" aria-label="Электронная карта гостя">
        <GuestCard/>
        <div className="lb-card-caption"><WalletCards size={22} aria-hidden="true"/><div><strong>В телефоне. Всегда рядом.</strong><span>Программа готовится к запуску.</span></div></div>
      </aside>
    </section>

    <section className="container lb-instructions" aria-labelledby="loyalty-steps-title">
      <div className="lb-section-heading">
        <div><span className="lb-kicker">ЧЕТЫРЕ ПРОСТЫХ ШАГА</span><h2 id="loyalty-steps-title">Как получить карту</h2></div>
        <p className="lb-launch-note">Регистрация и SMS пока недоступны.<br/>Ссылку добавим к запуску.</p>
      </div>
      <ol className="lb-steps">
        {registrationSteps.map(({ title, text, Icon }, index) => <li key={title}>
          <div className="lb-step-top"><span>{String(index + 1).padStart(2, '0')}</span><Icon size={26} strokeWidth={1.5} aria-hidden="true"/></div>
          <h3>{title}</h3>
          <p>{text}</p>
        </li>)}
      </ol>
    </section>

    <section id="get-card" className="container lb-signup" aria-labelledby="loyalty-signup-title">
      <div className="lb-signup-copy"><span className="lb-kicker">ДАВАЙТЕ ЗНАКОМИТЬСЯ</span><h2 id="loyalty-signup-title">До новой<br/><em>встречи в Ялте</em></h2><p>Пока можно попробовать<br/>регистрацию в деморежиме.</p><Link to="/delivery" className="lb-text-link">Посмотреть меню <ArrowUpRight size={19} aria-hidden="true"/></Link></div>
      <div className="lb-signup-form">
        {user?.loyaltyRequested ? <div className="lb-success" role="status">
          <span className="lb-success-icon"><Check size={25} strokeWidth={1.7} aria-hidden="true"/></span>
          <h3>Заявка сохранена</h3>
          <p>Демо-заявка осталась в этом браузере. Настоящая карта пока не выпускается.</p>
          <Link to="/account" className="button button-outline">Перейти в кабинет <ArrowUpRight size={19} aria-hidden="true"/></Link>
        </div> : <form onSubmit={register}>
          <h3>Карта гостя</h3>
          <p>{user ? `${user.name || 'Гость'}, рады знакомству!` : 'Войдите в тестовый профиль.'}</p>
          {user && <div className="lb-user"><span>{user.name}</span><strong>{user.phone}</strong></div>}
          <label className="lb-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required={Boolean(user)}/><span>Понимаю, что это демо без выпуска карты.</span></label>
          <button type="submit" className="button">{user ? 'Сохранить заявку' : 'Войти и продолжить'} <ArrowUpRight size={19} aria-hidden="true"/></button>
        </form>}
      </div>
    </section>

    <section className="container lb-faq" aria-labelledby="loyalty-faq-title">
      <div><span className="lb-kicker">ПОЛЕЗНО ЗНАТЬ</span><h2 id="loyalty-faq-title">О карте</h2></div>
      <div className="lb-faq-items">
        <details><summary>Когда заработает программа?<Plus size={20} aria-hidden="true"/></summary><p>После подключения системы лояльности. Правила опубликуем к запуску.</p></details>
        <details><summary>Как пользоваться картой?<Plus size={20} aria-hidden="true"/></summary><p>Сохраните её в телефоне и показывайте перед оплатой. Условия для доставки объявим к запуску.</p></details>
      </div>
    </section>
  </main>;
}