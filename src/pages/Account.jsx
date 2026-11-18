import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, CalendarDays } from 'lucide-react';
import { useShop } from '../store';
import { asset } from '../components';
import { normalizePhone, changeQuantity } from '../domain';
import './secondary.css';
import './account-readable.css';

const rub = value => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value || 0);
const dateLabel = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' }); };
const tabs = [['orders', 'Мои заказы'], ['reservations', 'Бронирования'], ['profile', 'Мои данные']];

function centerMobileNavItem(nav, item) {
  if (!nav || !item || !nav.clientWidth || !window.matchMedia('(max-width: 700px)').matches) return;
  nav.scrollTo({
    left: item.offsetLeft - nav.clientWidth / 2 + item.clientWidth / 2,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}

function AccountEmpty({ title, description, image, children }) {
  return <div className="account-empty">
    <div className="account-empty-copy">
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
    <img className="account-empty-photo" src={asset(image)} alt="" width="400" height="400"/>
  </div>;
}

function Profile({ user, setUser, notify }) {
  const [draft, setDraft] = useState({ name: user.name || '', phone: user.phone || '', email: user.email || '', address: user.address || '' });
  const [saved, setSaved] = useState(false);
  function save(event) {
    event.preventDefault();
    if (draft.name.trim().length < 2) return notify('Укажите имя: минимум 2 буквы.');
    const phone = normalizePhone(draft.phone);
    if (!phone) return notify('Укажите телефон из 11 цифр, начиная с 7 или 8.');
    setUser({ ...user, ...Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()])), phone });
    setSaved(true);
    notify('Данные сохранены в этом браузере');
  }
  return <div className="account-panel"><div className="account-panel-head"><div><h2>Мои данные</h2></div></div>
    <form className="profile-form" onSubmit={save}>
      <label>Как вас зовут<input name="name" autoComplete="given-name" required maxLength={60} value={draft.name} onChange={e => { setDraft({ ...draft, name: e.target.value }); setSaved(false); }} placeholder="Ваше имя"/></label>
      <label>Телефон<input name="phone" type="tel" autoComplete="tel" readOnly value={draft.phone} aria-describedby="profile-phone-hint"/><span id="profile-phone-hint">Номер для ваших заказов</span></label>
      <label className="profile-wide">Электронная почта <span>необязательно</span><input name="email" type="email" autoComplete="email" value={draft.email} onChange={e => { setDraft({ ...draft, email: e.target.value }); setSaved(false); }} placeholder="hello@example.ru"/></label>
      <label className="profile-wide">Адрес доставки<input name="address" autoComplete="street-address" maxLength={250} value={draft.address} onChange={e => { setDraft({ ...draft, address: e.target.value }); setSaved(false); }} placeholder="Москва, улица, дом, квартира"/></label>
      <div className="profile-actions profile-wide"><button className="button" type="submit">Сохранить изменения <ArrowUpRight size={18} aria-hidden="true"/></button>{saved && <span role="status" className="profile-saved">Изменения сохранены</span>}</div>
    </form><p className="account-data-note">Демо-профиль: данные остаются в этом браузере.</p>
  </div>;
}

export default function Account() {
  const { user, setUser, orders = [], reservations = [], setCart, notify, openAuth, setModal } = useShop();
  const [tab, setTab] = useState('orders');
  const mobileNav = useRef(null);
  const signedIn = Boolean(user);
  useEffect(() => {
    const centerSelected = () => {
      const nav = mobileNav.current;
      centerMobileNavItem(nav, nav?.querySelector('[aria-current="page"]'));
    };
    centerSelected();
    window.addEventListener('resize', centerSelected);
    return () => window.removeEventListener('resize', centerSelected);
  }, [tab, signedIn]);
  if (!user) return (
    <main className="account-entry container" aria-labelledby="account-entry-title">
      <div className="account-entry-copy">
        <span className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span>
        <h1 id="account-entry-title">Рады видеть <em>вас снова</em></h1>
        <p>Здесь можно посмотреть заказы, бронирования и сохранить адрес доставки.</p>
        <button className="button" onClick={openAuth}>Войти / создать профиль <ArrowUpRight size={18} aria-hidden="true"/></button>
        <small>Демо без SMS. Данные остаются в этом браузере.</small>
        <Link className="account-text-link" to="/delivery">Посмотреть меню <ArrowRight size={18} aria-hidden="true"/></Link>
      </div>
      <div className="account-entry-art">
        <img src={asset('generated/scene/interior-table-hero.webp')}
          srcSet={`${asset('generated/scene/interior-table-hero.webp')} 640w, ${asset('generated/scene/interior-table.jpg')} 1086w`}
          sizes="(max-width: 480px) calc(100vw - 40px), (max-width: 700px) 390px, (max-width: 1100px) 37vw, 465px"
          width="640" height="853" alt="Сервированный столик у окна в кафе «Ялта»"/>
      </div>
    </main>
  );

  function repeatOrder(order) {
    setCart(previous => order.items.filter(item => !item.isGift).reduce((next, item) => changeQuantity(next, item, item.quantity || 1), previous));
    notify('Блюда из заказа добавлены в корзину');
  }

  return <main className="account-page container" style={{ '--account-ornament': `url(${asset('brand/olive-border.svg')})` }}><div className="account-title"><div><span className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span><h1>Здравствуйте, <em>{user.name || 'гость'}</em></h1></div><span className="demo-pill"><span/>Демо-кабинет</span></div>
    <div className="account-layout"><aside className="account-sidebar"><div className="account-person"><span className="account-avatar">{(user.name || 'Я').slice(0, 1).toUpperCase()}</span><div><strong>{user.name || 'Гость'}</strong><small>{user.phone}</small></div></div><nav ref={mobileNav} aria-label="Разделы личного кабинета">{tabs.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={event => { setTab(key); if (tab === key) centerMobileNavItem(mobileNav.current, event.currentTarget); }} aria-current={tab === key ? 'page' : undefined}>{label}</button>)}<Link to="/loyalty" onClick={event => centerMobileNavItem(mobileNav.current, event.currentTarget)}>Карта гостя</Link></nav><button className="account-logout" onClick={() => { setUser(null); notify('Вы вышли из кабинета'); }}>Выйти</button></aside>
    <section className="account-main" aria-label={tabs.find(([key]) => key === tab)?.[1]}>
      {tab === 'profile' && <Profile user={user} setUser={setUser} notify={notify}/>}
      {tab === 'orders' && <div className="account-panel"><div className="account-panel-head"><div><h2>Мои заказы <span className="account-count">{orders.length}</span></h2></div>{orders.length > 0 && <Link to="/delivery" className="account-text-link">В меню <ArrowUpRight size={18} aria-hidden="true"/></Link>}</div>
        {!orders.length ? <AccountEmpty title="Пока без заказов" description="Начните с любимого блюда." image="generated/menu/b1.jpg">
          <Link className="button" to="/delivery">Выбрать блюда <ArrowUpRight size={18} aria-hidden="true"/></Link>
        </AccountEmpty> : <div className="order-history">{orders.map(order => <article className="history-order" key={order.id}><div className="history-order-heading"><div><strong>Заказ № {String(order.id).slice(-6)}</strong><span>{dateLabel(order.createdAt)} · {order.method === 'pickup' ? 'Самовывоз' : 'Доставка'}</span></div><span className="order-demo-status">Тестовый заказ</span></div><div className="order-history-items">{order.items.map((item, index) => <div key={`${item.id}-${index}`}><span>{item.isGift ? `Морс в подарок · ${item.weight}` : `${item.quantity || 1} × ${item.name}`}</span><span>{rub(item.price * (item.quantity || 1))}</span></div>)}{order.method !== 'pickup' && order.deliveryFee != null && <div className="history-delivery-fee"><span>Доставка</span><span>{rub(order.deliveryFee)}</span></div>}</div><div className="order-address"><span>Куда</span><p>{order.address || (order.method === 'pickup' ? 'Самовывоз из кафе' : user.address || 'Адрес не указан')}</p></div><p className="order-status-note">В кафе не отправлен.</p><div className="history-order-footer"><strong>{rub(order.total)}</strong><Link className="button button-outline" to="/delivery" onClick={() => repeatOrder(order)}>Повторить заказ <ArrowUpRight size={18} aria-hidden="true"/></Link></div></article>)}</div>}
      </div>}
      {tab === 'reservations' && <div className="account-panel"><div className="account-panel-head"><div><h2>Бронирования <span className="account-count">{reservations.length}</span></h2></div></div>{!reservations.length ? <AccountEmpty title="Пока без бронирований" description="Выберите день и время для встречи в «Ялте»." image="generated/scene/interior-table-hero.webp">
        <button type="button" className="button" onClick={() => setModal('booking')}>Забронировать стол</button>
      </AccountEmpty> : <div className="reservation-history">{reservations.map(reservation => <article key={reservation.id} className="reservation-item"><div className="reservation-date"><CalendarDays size={24} strokeWidth={1.5} aria-hidden="true"/><strong>{dateLabel(reservation.date)}</strong><span>{reservation.time}</span></div><div><h3>Встречаемся в «Ялте»</h3><p>{reservation.guests} гостей · {reservation.name || user.name}</p><span className="order-demo-status">Тестовая заявка</span><p className="order-status-note">Заявка не отправлена в кафе.</p></div></article>)}</div>}</div>}
    </section></div>
  </main>;
}
