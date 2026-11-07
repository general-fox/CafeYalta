import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Waves } from 'lucide-react';
import { useShop } from '../store';
import { normalizePhone, changeQuantity } from '../domain';
import './secondary.css';
import './account-readable.css';

const rub = value => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(value || 0);
const dateLabel = value => { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' }); };
const tabs = [['orders', 'Мои заказы'], ['reservations', 'Бронирования'], ['profile', 'Мои данные']];

function SmallIcon({ kind = 'bag' }) {
  return <svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">{kind === 'calendar' ? <><rect x="5" y="7" width="22" height="21" rx="4"/><path d="M5 13h22M11 4v6M21 4v6M11 18h3M18 18h3M11 23h3"/></> : <><path d="M7 10h18l2 18H5l2-18Z"/><path d="M11 12V8a5 5 0 0 1 10 0v4"/></>}</svg>;
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
  const { user, setUser, orders = [], reservations = [], setCart, notify, openAuth } = useShop();
  const [tab, setTab] = useState('orders');
  if (!user) return <main className="account-entry container"><div className="account-entry-art" aria-hidden="true"><div className="account-entry-orbit"/><span className="account-entry-letter">Я</span><Waves className="account-entry-bird" aria-hidden="true"/><p>ВАШЕ МЕСТО У МОРЯ</p></div><div className="account-entry-copy"><span className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span><h1>Рады видеть<br/><em>вас снова.</em></h1><p>Заказы, бронирования и любимый адрес — в одном месте.</p><button className="button" onClick={openAuth}>Войти / создать профиль <ArrowUpRight size={18} aria-hidden="true"/></button><small>Демо без SMS. Данные остаются в этом браузере.</small><Link className="account-text-link" to="/delivery">Посмотреть меню <ArrowRight size={18} aria-hidden="true"/></Link></div></main>;

  function repeatOrder(order) {
    setCart(previous => order.items.filter(item => !item.isGift).reduce((next, item) => changeQuantity(next, item, item.quantity || 1), previous));
    notify('Блюда из заказа добавлены в корзину');
  }

  return <main className="account-page container"><div className="account-title"><div><span className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span><h1>Здравствуйте, <em>{user.name || 'гость'}.</em></h1></div><span className="demo-pill"><span/>Демо-кабинет</span></div>
    <div className="account-layout"><aside className="account-sidebar"><div className="account-person"><span className="account-avatar">{(user.name || 'Я').slice(0, 1).toUpperCase()}</span><div><strong>{user.name || 'Гость'}</strong><small>{user.phone}</small></div></div><nav aria-label="Разделы личного кабинета">{tabs.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined}>{label}<ArrowUpRight size={18} aria-hidden="true"/></button>)}<Link to="/loyalty">Карта гостя <ArrowUpRight size={18} aria-hidden="true"/></Link></nav><button className="account-logout" onClick={() => { setUser(null); notify('Вы вышли из кабинета'); }}>Выйти</button></aside>
    <section className="account-main" aria-label={tabs.find(([key]) => key === tab)?.[1]}>
      {tab === 'profile' && <Profile user={user} setUser={setUser} notify={notify}/>}
      {tab === 'orders' && <div className="account-panel"><div className="account-panel-head"><div><h2>Мои заказы <span className="account-count">{orders.length}</span></h2></div><Link to="/delivery" className="account-text-link">В меню <ArrowUpRight size={18} aria-hidden="true"/></Link></div>
        {!orders.length ? <div className="account-empty"><span className="account-empty-icon"><SmallIcon/></span><h3>Пока без заказов</h3><p>Начните с любимого блюда.</p><Link className="button" to="/delivery">Выбрать блюда <ArrowUpRight size={18} aria-hidden="true"/></Link></div> : <div className="order-history">{orders.map(order => <article className="history-order" key={order.id}><div className="history-order-heading"><div><strong>Заказ № {String(order.id).slice(-6)}</strong><span>{dateLabel(order.createdAt)} · {order.method === 'pickup' ? 'Самовывоз' : 'Доставка'}</span></div><span className="order-demo-status">Тестовый заказ</span></div><div className="order-history-items">{order.items.map((item, index) => <div key={`${item.id}-${index}`}><span>{item.isGift ? `Морс в подарок · ${item.weight}` : `${item.quantity || 1} × ${item.name}`}</span><span>{rub(item.price * (item.quantity || 1))}</span></div>)}{order.method !== 'pickup' && <div className="history-delivery-fee"><span>Доставка</span><span>{order.deliveryFee ? rub(order.deliveryFee) : 'Бесплатно'}</span></div>}</div><div className="order-address"><span>Куда</span><p>{order.address || (order.method === 'pickup' ? 'Самовывоз из кафе' : user.address || 'Адрес не указан')}</p></div><p className="order-status-note">В ресторан не отправлен.</p><div className="history-order-footer"><strong>{rub(order.total)}</strong><Link className="button button-outline" to="/delivery" onClick={() => repeatOrder(order)}>Повторить заказ <ArrowUpRight size={18} aria-hidden="true"/></Link></div></article>)}</div>}
      </div>}
      {tab === 'reservations' && <div className="account-panel"><div className="account-panel-head"><div><h2>Бронирования <span className="account-count">{reservations.length}</span></h2></div></div>{!reservations.length ? <div className="account-empty"><span className="account-empty-icon"><SmallIcon kind="calendar"/></span><h3>Пока без бронирований</h3><p>Выберите день и время через кнопку «Забронировать стол».</p></div> : <div className="reservation-history">{reservations.map(reservation => <article key={reservation.id} className="reservation-item"><div className="reservation-date"><SmallIcon kind="calendar"/><strong>{dateLabel(reservation.date)}</strong><span>{reservation.time}</span></div><div><h3>Встречаемся в «Ялте»</h3><p>{reservation.guests} гостей · {reservation.name || user.name}</p><span className="order-demo-status">Тестовая заявка</span><p className="order-status-note">Заявка не отправлена в ресторан.</p></div></article>)}</div>}</div>}
    </section></div>
  </main>;
}
