import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, CalendarDays } from 'lucide-react';
import { useShop } from '../store';
import FoodImage from '../FoodImage';
import { sceneImageProps } from '../interiorPhotos';
import { formatPhone, changeQuantity } from '../domain';
import { configuredIikoProduct } from '../iiko';

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

function AccountEmpty({ title, description, photo, children }) {
  return <div className="account-empty">
    <div className="account-empty-copy">
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
    {photo}
  </div>;
}

function Profile({ user, setUser, notify, isIiko }) {
  const [draft, setDraft] = useState({ name: user.name || '', email: user.email || '', address: user.address || '' });
  const [saved, setSaved] = useState(false);
  function save(event) {
    event.preventDefault();
    if (draft.name.trim().length < 2) return notify('Укажите имя: минимум 2 буквы.');
    setUser({ ...user, ...Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value.trim()])) });
    setSaved(true);
    notify('Данные сохранены в этом браузере');
  }
  return <div className="account-panel" data-reveal="soft"><div className="account-panel-head"><div><h2>Мои данные</h2></div></div>
    <form className="profile-form" onSubmit={save}>
      <label>Как вас зовут<input name="name" autoComplete="given-name" required maxLength={60} value={draft.name} onChange={e => { setDraft({ ...draft, name: e.target.value }); setSaved(false); }} placeholder="Ваше имя"/></label>
      <label>Телефон<input name="phone" type="tel" autoComplete="tel" readOnly value={formatPhone(user.phone)} aria-describedby="profile-phone-hint"/><span id="profile-phone-hint">Номер для ваших заказов</span></label>
      <label className="profile-wide">Электронная почта <span>необязательно</span><input name="email" type="email" autoComplete="email" value={draft.email} onChange={e => { setDraft({ ...draft, email: e.target.value }); setSaved(false); }} placeholder="hello@example.ru"/></label>
      <label className="profile-wide">Адрес доставки<input name="address" autoComplete="street-address" maxLength={250} readOnly={isIiko} aria-describedby={isIiko ? 'profile-address-hint' : undefined} value={draft.address} onChange={e => { setDraft({ ...draft, address: e.target.value }); setSaved(false); }} placeholder="Москва, улица, дом, квартира"/>{isIiko && <span id="profile-address-hint">Адрес указывается и изменяется при оформлении доставки. Здесь показан последний сохранённый адрес.</span>}</label>
      <div className="profile-actions profile-wide"><button className="button" type="submit">Сохранить изменения <ArrowUpRight size={18} aria-hidden="true"/></button>{saved && <span role="status" className="profile-saved">Изменения сохранены</span>}</div>
    </form><p className="account-data-note">{isIiko ? 'Сохранённые контакты в этом браузере. При оформлении имя, телефон и адрес доставки передаются вместе с заказом в iiko.' : 'Демо-профиль: данные остаются в этом браузере.'}</p>
  </div>;
}

function OrderHistoryCard({ order, user, repeatOrder, repeatDisabled }) {
  const isIikoOrder = order.source === 'iiko';
  const status = isIikoOrder
    ? ({ accepted: 'Принят кафе', failed: 'Не принят', processing: 'Ожидает подтверждения' }[order.status] || 'Статус не подтверждён')
    : 'Тестовый заказ';
  const title = isIikoOrder
    ? Number.isSafeInteger(order.number) && order.number >= 0 ? `Заказ № ${order.number}` : 'Заказ в iiko'
    : `Заказ № ${String(order.id).slice(-6)}`;
  const statusNote = isIikoOrder
    ? order.status === 'accepted' ? 'Получение заказа подтверждено iikoFront. Здесь сохранён результат оформления; дальнейшие этапы приготовления не отслеживаются.'
      : order.status === 'failed' ? 'iiko не подтвердила приём заказа.' : 'Приём заказа пока не подтверждён. Проверьте состояние на странице оформления.'
    : 'В кафе не отправлен.';
  const address = order.address || (order.method === 'pickup' ? 'Самовывоз из кафе' : isIikoOrder ? 'Адрес не сохранён' : user?.address || 'Адрес не указан');
  return <article className="history-order">
    <div className="history-order-heading"><div><strong>{title}</strong><span>{dateLabel(order.createdAt)} · {order.method === 'pickup' ? 'Самовывоз' : 'Доставка'}</span></div><span className="order-demo-status">{status}</span></div>
    <div className="order-history-items">{order.items.map((item, index) => <div key={`${item.lineId || item.id}-${index}`}><span>{item.isGift ? `Морс в подарок · ${item.weight}` : `${item.quantity || 1} × ${item.name}`}{item.modifiers?.length > 0 && <small className="history-modifiers">{item.modifiers.map(modifier => `${modifier.name}${modifier.quantity > 1 ? ` × ${modifier.quantity}` : ''}`).join(', ')}</small>}</span><span>{rub(item.price * (item.quantity || 1))}</span></div>)}{order.method !== 'pickup' && order.deliveryFee != null && <div className="history-delivery-fee"><span>Доставка</span><span>{rub(order.deliveryFee)}</span></div>}</div>
    <div className="order-address"><span>Куда</span><p>{address}</p></div><p className="order-status-note">{statusNote}</p>
    <div className="history-order-footer"><strong>{rub(order.total)}</strong><Link className="button button-outline" to="/delivery" aria-disabled={repeatDisabled || undefined} onClick={event => { if (!repeatOrder(order)) event.preventDefault(); }}>Повторить заказ <ArrowUpRight size={18} aria-hidden="true"/></Link></div>
  </article>;
}

export default function Account() {
  const { user, setUser, orders = [], reservations = [], setCart, notify, openAuth, setModal, isIiko, products = [], orderLocked, catalogStatus, orderingEnabled } = useShop();
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
  if (!user && !isIiko) return (
    <main className="account-entry container" aria-labelledby="account-entry-title">
      <div className="account-entry-copy" data-reveal-group>
        <span className="eyebrow" data-reveal="rise">ЛИЧНЫЙ КАБИНЕТ</span>
        <h1 id="account-entry-title" data-reveal="rise">Рады видеть <em>вас снова</em></h1>
        <p data-reveal="rise">Здесь можно посмотреть заказы, бронирования и сохранить адрес доставки.</p>
        <button className="button" data-reveal="soft" onClick={openAuth}>Войти / создать профиль <ArrowUpRight size={18} aria-hidden="true"/></button>
        <small data-reveal="soft">Демо без SMS. Данные остаются в этом браузере.</small>
        <Link className="account-text-link" data-reveal="soft" to="/delivery">Посмотреть меню <ArrowRight size={18} aria-hidden="true"/></Link>
      </div>
      <div className="account-entry-art" data-reveal="soft">
        <img {...sceneImageProps('interior-table', '(max-width: 480px) calc(100vw - 40px), (max-width: 700px) 390px, (max-width: 1100px) 37vw, 465px')} decoding="async"
          width="640" height="853" alt="Сервированный столик у окна в кафе «Ялта»"/>
      </div>
    </main>
  );

  function repeatOrder(order) {
    if (orderLocked) { notify('Сначала проверьте состояние отправленного заказа'); return false; }
    if (isIiko) {
      if (catalogStatus !== 'ready' || !orderingEnabled) { notify('Дождитесь загрузки актуального меню и доступности заказов'); return false; }
      const byId = new Map(products.map(product => [product.id, product]));
      const requested = order.items.filter(item => !item.isGift);
      const available = requested.flatMap(item => {
        const product = byId.get(item.id);
        if (product?.source !== 'iiko' || product.available !== true) return [];
        try { return [{ product: configuredIikoProduct(product, item.selections), quantity: Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 1 }]; }
        catch { return []; }
      });
      if (!available.length) { notify('Блюда из этого заказа сейчас недоступны. Выберите блюда в меню'); return false; }
      if (!setCart(previous => available.reduce((next, { product, quantity }) => changeQuantity(next, product, quantity), previous))) return false;
      notify(available.length < requested.length
        ? 'Доступные блюда добавлены по текущим ценам. Для остальных нужно заново выбрать блюдо и дополнения'
        : 'Блюда добавлены по текущим ценам');
      return true;
    }
    setCart(previous => order.items.filter(item => !item.isGift).reduce((next, item) => changeQuantity(next, item, item.quantity || 1), previous));
    notify('Блюда из заказа добавлены в корзину');
    return true;
  }

  const greeting = user ? `Привет, ${user.name || 'гость'}` : 'Ваши заказы';
  return <main className="account-page container">
    <div className="account-title" data-reveal-group>
      <span className="eyebrow" data-reveal="rise">{isIiko ? 'ИСТОРИЯ В ЭТОМ БРАУЗЕРЕ' : 'ЛИЧНЫЙ КАБИНЕТ'}</span>
      <h1 data-reveal="rise" style={{ '--greeting-length': greeting.length }} title={greeting}>{greeting}</h1>
    </div>
    <div className="account-layout"><aside className="account-sidebar"><div className="account-person" data-reveal="soft"><span className="account-avatar">{(user?.name || 'Я').slice(0, 1).toUpperCase()}</span><div><strong>{user?.name || 'Гость'}</strong>{user?.phone && <small>{formatPhone(user.phone)}</small>}</div></div><nav ref={mobileNav} data-reveal="soft" aria-label="Разделы личного кабинета">{tabs.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={event => { setTab(key); if (tab === key) centerMobileNavItem(mobileNav.current, event.currentTarget); }} aria-current={tab === key ? 'page' : undefined}>{label}</button>)}<Link to="/loyalty" onClick={event => centerMobileNavItem(mobileNav.current, event.currentTarget)}>Карта гостя</Link></nav>{user && <button className="account-logout" data-reveal="soft" onClick={() => { setUser(null); notify(isIiko ? 'Сохранённые контакты скрыты. История заказов остаётся в этом браузере' : 'Вы вышли из кабинета'); }}>{isIiko ? 'Скрыть мои контакты' : 'Выйти'}</button>}</aside>
    <section className="account-main" aria-label={tabs.find(([key]) => key === tab)?.[1]}>
      {tab === 'profile' && (user ? <Profile user={user} setUser={setUser} notify={notify} isIiko={isIiko}/> : <AccountEmpty title="Контакты для заказа" description="Укажите имя и телефон при оформлении. Они будут сохранены в этом браузере для следующего заказа."><Link className="button" to="/delivery">Выбрать блюда</Link></AccountEmpty>)}
      {tab === 'orders' && <div className="account-panel" data-reveal="soft"><div className="account-panel-head"><div><h2>Мои заказы <span className="account-count">{orders.length}</span></h2></div>{orders.length > 0 && <Link to="/delivery" className="account-text-link">В меню <ArrowUpRight size={18} aria-hidden="true"/></Link>}</div>
        {isIiko && <p className="account-data-note">Здесь сохранены заказы, оформленные в этом браузере. История доступна на этом устройстве без входа по SMS.</p>}
        {!orders.length ? <AccountEmpty title="Пока без заказов" description="Начните с любимого блюда." photo={<FoodImage product={{ id: 'b1' }} variant="card" className="account-empty-photo" alt=""/>}>
          <Link className="button" to="/delivery">Выбрать блюда <ArrowUpRight size={18} aria-hidden="true"/></Link>
        </AccountEmpty> : <div className="order-history">{orders.map(order => <OrderHistoryCard key={order.id} order={order} user={user} repeatOrder={repeatOrder} repeatDisabled={orderLocked || (isIiko && (catalogStatus !== 'ready' || !orderingEnabled))}/>)}</div>}
      </div>}
      {tab === 'reservations' && <div className="account-panel" data-reveal="soft"><div className="account-panel-head"><div><h2>Бронирования <span className="account-count">{reservations.length}</span></h2></div></div>{!reservations.length ? <AccountEmpty title="Пока без бронирований" description="Выберите день и время для встречи в «Ялте»." photo={<img {...sceneImageProps('interior-table', 'auto, (max-width: 700px) calc(100vw - 64px), 320px')} loading="lazy" decoding="async" className="account-empty-photo" width="640" height="853" alt=""/>}>
        <button type="button" className="button" onClick={() => setModal('booking')}>Забронировать стол</button>
      </AccountEmpty> : <div className="reservation-history">{reservations.map(reservation => <article key={reservation.id} className="reservation-item"><div className="reservation-date"><CalendarDays size={24} strokeWidth={1.5} aria-hidden="true"/><strong>{dateLabel(reservation.date)}</strong><span>{reservation.time}</span></div><div><h3>Встречаемся в «Ялте»</h3><p>{reservation.guests} гостей · {reservation.name || user?.name || 'Гость'}</p><span className="order-demo-status">Тестовая заявка</span><p className="order-status-note">Заявка не отправлена в кафе.</p></div></article>)}</div>}</div>}
    </section></div>
  </main>;
}
