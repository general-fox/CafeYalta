import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Routes, Route, NavLink, Link, useLocation, useMatch } from 'react-router-dom';
import { ArrowUpRight, UserRound, ShoppingBag, Menu, X, Check, Phone } from 'lucide-react';
import { useShop } from './store';
import { asset, Waves } from './components';
import { money, cartTotal } from './domain';
import Delivery from './pages/Delivery';
import HomeHero from './HomeHero';
import AboutCafe from './AboutCafe';
import GuestCard from './GuestCard';
import Checkout from './pages/Checkout';
import Account from './pages/Account';
import Loyalty from './pages/Loyalty';
import Modals from './modals';
function OliveBorder() {
  return <div className="olive-border" aria-hidden="true"/>;
}

function Header({ cartCount }) {
  const { user, openAuth, setModal } = useShop();
  const [mobile, setMobile] = useState(false);
  const location = useLocation();
  const header = useRef(null);
  const navigation = useRef(null);
  const menuButton = useRef(null);

  useEffect(() => setMobile(false), [location.pathname]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 701px)');
    const closeDesktopMenu = () => { if (desktop.matches) setMobile(false); };
    desktop.addEventListener('change', closeDesktopMenu);
    return () => desktop.removeEventListener('change', closeDesktopMenu);
  }, []);
  useEffect(() => {
    if (!mobile) return;
    navigation.current?.querySelector('a')?.focus();
    const closeOnEscape = event => {
      if (event.key === 'Escape') { setMobile(false); menuButton.current?.focus(); }
    };
    const closeOutside = event => {
      if (!header.current?.contains(event.target)) setMobile(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOutside);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOutside);
    };
  }, [mobile]);

  return <header ref={header} className="site-header">
    <OliveBorder/>
    <div className="surface-grain" aria-hidden="true"/>
    <div className="header-inner">
    <Link className="brand" to="/" aria-label="Кафе Ялта — главная" onClick={() => setMobile(false)}>
      <img className="brand-logo" src={asset('brand/CafeYalta-light.svg')} alt="Кафе Ялта" width="700" height="100"/>
      <img className="brand-caption" src={asset('brand/home-cooking.svg')} alt="Домашняя кухня" width="563" height="57"/>
    </Link>
    <nav ref={navigation} id="main-navigation" className={mobile ? 'main-nav is-open' : 'main-nav'} aria-label="Главная навигация">
      <NavLink to="/delivery">Доставка</NavLink>
      <NavLink to="/loyalty">Программа лояльности</NavLink>
      <a href="#/#about" onClick={() => { setMobile(false); setTimeout(() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' }), 60); }}>О нас</a>
      {mobile && (user
        ? <NavLink to="/account" onClick={() => setMobile(false)}>Личный кабинет</NavLink>
        : <button type="button" className="mobile-account-entry" onClick={() => {
            menuButton.current?.focus();
            setMobile(false);
            openAuth();
          }}>Войти в личный кабинет</button>
      )}
    </nav>
    <div className="header-actions">
      {user ? <Link className="account-button" to="/account" aria-label="Личный кабинет" title="Личный кабинет" onClick={() => setMobile(false)}><UserRound size={22} aria-hidden="true"/></Link> : <button type="button" className="account-button" aria-label="Войти в личный кабинет" title="Войти в личный кабинет" onClick={() => { setMobile(false); openAuth(); }}><UserRound size={22} aria-hidden="true"/></button>}
      <a className="header-phone" href="tel:+74951234567" aria-label="Позвонить в кафе: +7 (495) 123-45-67" title="Позвонить в кафе" onClick={() => setMobile(false)}><Phone size={22} aria-hidden="true"/></a>
      <button type="button" className="header-cart" disabled={!cartCount} aria-label={`Корзина, порций: ${cartCount}`} title="Открыть корзину" aria-haspopup="dialog" onClick={() => setModal('cart')}>
        <ShoppingBag size={22} aria-hidden="true"/><span aria-hidden="true">{cartCount}</span>
      </button>
      <button ref={menuButton} type="button" className="mobile-menu icon-button" onClick={() => setMobile(open => !open)} aria-expanded={mobile} aria-controls="main-navigation" aria-label={mobile ? 'Закрыть меню' : 'Открыть меню'} title={mobile ? 'Закрыть меню' : 'Открыть меню'}>{mobile ? <X size={24} aria-hidden="true"/> : <Menu size={24} aria-hidden="true"/>}</button>
    </div>
  </div></header>;
}
function Home() {
  const gullOrigin = useRef(null);

  return <main className="home-page">
    <div className="coastal-intro">
      <HomeHero gullOrigin={gullOrigin}/>
      <AboutCafe gullOrigin={gullOrigin}/>
    </div>
    <section className="home-guest-section" aria-labelledby="home-guest-title">
      <div className="container home-guest-layout">
        <div className="home-guest-info reveal">
          <span className="eyebrow">ПРОГРАММА ЛОЯЛЬНОСТИ</span>
          <h2 id="home-guest-title">Хорошо быть <em>своим</em></h2>
          <p>Бонусы за любимые блюда и сюрпризы для наших гостей.</p>
          <Link className="button home-guest-action" to="/loyalty">Как получить карту</Link>
          <small>Программа готовится к запуску</small>
        </div>
        <div className="home-guest-card reveal">
          <GuestCard/>
        </div>
      </div>
    </section>
  </main>;
}
function Footer() {
  return <footer className="site-footer">
    <OliveBorder/>
    <div className="container footer-inner">
      <div className="footer-main">
        <Link className="footer-brand" to="/">
          <img src={asset('brand/CafeYalta-light.svg')} alt="Кафе Ялта" width="700" height="100"/>
          <span>Немного моря в Москве</span>
        </Link>
        <nav className="footer-links" aria-label="Разделы сайта">
          <span className="eyebrow">ЗАГЛЯДЫВАЙТЕ</span>
          <Link to="/delivery">Доставка и меню</Link>
          <Link to="/loyalty">Программа лояльности</Link>
          <Link to="/account">Личный кабинет</Link>
        </nav>
        <div className="footer-contacts">
          <span className="eyebrow">МЫ РЯДОМ</span>
          <a href="tel:+74951234567">+7 (495) 123-45-67</a>
          <span>Москва, ЖК «Испанские кварталы»</span>
          <span>Ежедневно 11:00–23:00</span>
        </div>
        <Waves/>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Кафе «Ялта»</span>
        <span>Демо · контакты и меню — примеры</span>
        <Link to="/privacy">Конфиденциальность</Link>
      </div>
    </div>
  </footer>;
}
function Privacy() { return <main className="info-page paper-surface"><div className="container text-page"><span className="eyebrow">ВАШИ ДАННЫЕ</span><h1>Конфиденциальность</h1><p>Этот сайт — демонстрационная версия кафе «Ялта». Введённые имя, телефон, адрес, состав тестовых заказов и бронирований сохраняются только в локальном хранилище вашего браузера на этом устройстве. В кафе они не отправляются. Не вводите реальные персональные данные для тестирования.</p><h2>Как удалить данные</h2><p>Очистите данные сайта в настройках браузера. После этого удалятся профиль, корзина и вся тестовая история на этом устройстве.</p><h2>Перед открытием кафе</h2><p>Здесь появится политика оператора персональных данных с актуальными реквизитами, целями обработки, сроками хранения и контактами. Реальная авторизация, оплата и обработка заказов пока не подключены.</p><Link className="button" to="/">На главную <ArrowUpRight size={18}/></Link></div></main>; }
export default function App() { const location = useLocation(); const { setModal, cart, toast } = useShop();
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const isDelivery = useMatch('/delivery');
  const showCart = location.pathname !== '/checkout' && cartCount > 0;
  const mobileCart = showCart ? (
    <button className="mobile-cart-bar" type="button" aria-haspopup="dialog" onClick={() => setModal('cart')}>
      <ShoppingBag size={20} aria-hidden="true"/><span>Корзина · {cartCount}</span>
      <strong>{money(cartTotal(cart))}</strong>
    </button>
  ) : null;
  useLayoutEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); const titles = { '/': 'Кафе Ялта — доставка в Москве', '/delivery': 'Доставка и меню — Ялта', '/loyalty': 'Программа лояльности — Ялта', '/account': 'Личный кабинет — Ялта', '/checkout': 'Оформление заказа — Ялта' }; document.title = titles[location.pathname] || 'Кафе Ялта'; }, [location.pathname]);
  useEffect(() => { const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } }), { threshold: 0.07 }); const observe = () => document.querySelectorAll('.reveal:not(.is-visible)').forEach(el => observer.observe(el)); observe(); const mutation = new MutationObserver(observe); mutation.observe(document.getElementById('root'), { childList: true, subtree: true }); return () => { observer.disconnect(); mutation.disconnect(); }; }, []);
  return <><a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>Перейти к содержимому</a><Header cartCount={showCart ? cartCount : 0}/><div id="main-content" tabIndex={-1} className="route-content" key={location.pathname}><Routes><Route path="/" element={<Home/>}/><Route path="/delivery" element={<Delivery mobileCart={mobileCart}/>}/><Route path="/checkout" element={<Checkout/>}/><Route path="/account" element={<Account/>}/><Route path="/loyalty" element={<Loyalty/>}/><Route path="/privacy" element={<Privacy/>}/><Route path="*" element={<main className="info-page paper-surface"><div className="container text-page"><h1>Кажется, здесь только море</h1><Link className="button" to="/">Вернуться на берег</Link></div></main>}/></Routes></div><Footer/>{!isDelivery && mobileCart}<Modals/>{toast && <div className="toast" role="status"><Check size={18}/>{toast}</div>}</>;
}
