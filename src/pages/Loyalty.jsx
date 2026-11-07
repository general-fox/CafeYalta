import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useShop } from '../store';
import { asset } from '../components';
import './secondary.css';

function LoyaltyCard({ compact = false }) {
  return <div className={`guest-card ${compact ? 'guest-card-compact' : ''}`} aria-label="Образец карты гостя Ялты">{!compact && <div className="guest-card-top"><span>КАФЕ • МОСКВА</span><span>≈</span></div>}<div className="guest-card-logo"><img src={asset('brand/Yalta-white.svg')} alt="Ялта"/></div>{!compact && <div className="guest-card-bottom"><span>КАРТА ГОСТЯ</span><span>ДЕМО</span></div>}<svg className="guest-card-waves" viewBox="0 0 500 100" fill="none" aria-hidden="true"><path d="M-30 40Q30 0 90 40T210 40T330 40T450 40T570 40M-30 65Q30 25 90 65T210 65T330 65T450 65T570 65M-30 90Q30 50 90 90T210 90T330 90T450 90T570 90"/></svg></div>;
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
  return <main className="loyalty-page">
    <section className="loyalty-hero container"><div className="loyalty-hero-copy"><span className="eyebrow">ПРОГРАММА ЛОЯЛЬНОСТИ</span><h1>Своим —<br/><em>больше тепла.</em></h1><p>Любимые блюда и приятные привилегии. Для тех, кто с нами.</p><a href="#get-card" className="button" onClick={event => { event.preventDefault(); document.getElementById('get-card')?.scrollIntoView({ behavior: 'smooth' }); }}>Стать любимым гостем <span aria-hidden="true">↘</span></a><span className="loyalty-preview-label">Скоро в «Ялте»</span></div><div className="loyalty-hero-art"><div className="loyalty-orbit"/><LoyaltyCard/><span className="loyalty-sun" aria-hidden="true">☼</span><svg className="loyalty-bird" viewBox="0 0 80 30" fill="none" aria-hidden="true"><path d="M2 25Q22 0 40 24Q56 3 78 14"/></svg></div></section>
    <section className="loyalty-benefits container" aria-label="Предлагаемые привилегии"><div><span className="benefit-mark">01</span><h2>Вкусные бонусы</h2><p>Бонусы за любимые блюда.</p></div><div><span className="benefit-mark">02</span><h2>Личные поводы</h2><p>Комплимент в день рождения.</p></div><div><span className="benefit-mark">03</span><h2>Особое внимание</h2><p>Сезонные предложения для своих.</p></div></section>
    <section className="loyalty-how"><div className="container"><div className="loyalty-section-intro"><span className="eyebrow">ПАРА МИНУТ — И ВЫ С НАМИ</span><h2>Карта, которая<br/><em>всегда рядом.</em></h2></div>
      <div className="loyalty-steps">
        <article><span className="step-number">01</span><div className="step-illustration step-scan" aria-hidden="true"><div className="illustrated-code">{Array.from({ length: 35 }, (_, index) => <i key={index} className={[0, 1, 2, 4, 5, 6, 7, 9, 11, 13, 14, 15, 16, 18, 19, 20, 22, 25, 27, 28, 29, 30, 32, 34].includes(index) ? 'filled' : ''}/>)}</div><span className="scan-line"/></div><h3>Начнём знакомство</h3><p>Откройте ссылку регистрации или QR-код в кафе.</p></article>
        <article><span className="step-number">02</span><div className="step-illustration step-phone" aria-hidden="true"><div className="mini-phone mini-phone-sms"><div className="mini-phone-speaker"/><span>Ялта</span><i/><div className="sms-dots">• • • •</div><b>✓</b></div></div><h3>Это точно вы</h3><p>Введите телефон и код из SMS.</p></article>
        <article><span className="step-number">03</span><div className="step-illustration step-phone" aria-hidden="true"><div className="mini-phone"><div className="mini-phone-speaker"/><span>Ялта</span><i/><i/><i/><b>✓</b></div></div><h3>Пара слов о себе</h3><p>Заполните поля анкеты, отмеченные звёздочкой.</p></article>
        <article><span className="step-number">04</span><div className="step-illustration step-wallet" aria-hidden="true"><LoyaltyCard compact/><span className="wallet-add">+</span></div><h3>Вы — наш гость</h3><p>На экране карты нажмите «Добавить» справа вверху.</p></article>
      </div><p className="loyalty-instruction-note">Регистрация и SMS пока недоступны. Ссылку на карту добавим к запуску.</p></div></section>
    <section id="get-card" className="loyalty-signup container"><div><span className="eyebrow">ДАВАЙТЕ ЗНАКОМИТЬСЯ</span><h2>У каждой встречи<br/><em>есть продолжение.</em></h2><p>Попробуйте тестовую регистрацию.</p><Link to="/delivery" className="account-text-link">Посмотреть меню <span aria-hidden="true">↗</span></Link></div><div className="loyalty-signup-panel">{user?.loyaltyRequested ? <div className="loyalty-success" role="status"><span>✓</span><h3>Заявка сохранена</h3><p>Демо-заявка сохранена в браузере. Настоящая карта пока не выпускается.</p><Link to="/account" className="button button-outline">Перейти в кабинет <span aria-hidden="true">↗</span></Link></div> : <form onSubmit={register}><h3>Карта гостя</h3><p>{user ? `${user.name || 'Гость'}, рады знакомству!` : 'Войдите в тестовый профиль.'}</p>{user && <div className="loyalty-user-summary"><span>{user.name}</span><strong>{user.phone}</strong></div>}<label className="loyalty-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required={Boolean(user)}/><span>Понимаю, что это демо без выпуска карты.</span></label><button type="submit" className="button">{user ? 'Сохранить заявку' : 'Войти и продолжить'} <span aria-hidden="true">↗</span></button></form>}</div></section>
    <section className="loyalty-questions container"><h2>О карте</h2><details><summary>Когда заработает программа?<span>+</span></summary><p>После подключения системы лояльности. Привилегии на странице пока предварительные.</p></details><details><summary>Как пользоваться картой?<span>+</span></summary><p>Сохраните её в телефоне и показывайте перед оплатой. Условия для доставки объявим к запуску.</p></details></section>
  </main>;
}
