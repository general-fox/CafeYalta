import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, CircleDot, MapPin, ShoppingBag } from 'lucide-react';
import { useShop } from '../store';
import { cartTotal, money, normalizePhone } from '../domain';
import { apiRequest, createCheckoutAttempt, SAFE_REJECTION_CODES, validateOrderResult } from '../iiko';
import { Quantity } from '../components';
import FoodImage from '../FoodImage';
import RussianPhoneInput from '../RussianPhoneInput';

function Summary({ items, total, method = 'pickup', address, editable = false }) {
  const { setModal, orderLocked } = useShop();
  return <aside className="checkout-summary"><h2>Ваш заказ</h2>{items.map(item => <div className="checkout-item" key={item.lineId || item.id}><FoodImage product={{ ...item, source: 'iiko' }} alt=""/><div><h3>{item.name}</h3>{item.modifiers?.length > 0 && <ul className="selected-modifiers">{item.modifiers.map(modifier => <li key={`${modifier.groupId}:${modifier.modifierId}`}>{modifier.name}{modifier.quantity > 1 ? ` × ${modifier.quantity}` : ''}</li>)}</ul>}{editable ? <Quantity product={item} quantity={item.quantity}/> : <span>{item.quantity} порц.</span>}{editable && (item.modifierGroups?.length > 0 || item.selections?.length > 0) && <button type="button" className="modifier-edit" disabled={orderLocked} onClick={() => setModal({ type: 'product', product: item, editingLineId: item.lineId || item.id })}>Изменить дополнения</button>}{item.available === false && <p className="availability-note">{item.unavailableReason || 'Сейчас недоступно'}</p>}</div><strong>{money(item.price * item.quantity)}</strong></div>)}<div className="summary-line grand-total"><span>Итого</span><strong>{money(total)}</strong></div><small>{method === 'delivery' ? 'Доставка' : 'Самовывоз'} · наличными при получении. В тесте оплачиваются только блюда.</small>{address && <p className="field-hint">{addressLabel(address)}</p>}</aside>;
}

function addressLabel(address) {
  if (!address) return '';
  const base = address.type === 'city' ? address.line1 : [address.city, address.street, address.house && 'дом ' + address.house].filter(Boolean).join(', ');
  return [base, address.building && 'корпус ' + address.building, address.flat && 'кв. ' + address.flat, address.entrance && 'подъезд ' + address.entrance, address.floor && 'этаж ' + address.floor].filter(Boolean).join(', ');
}

function AddressFields({ format, saved }) {
  return <>
    <h2>Куда привезти?</h2>
    {format === 'legacy' ? <div className="form-grid">
      <label>Город *<input name="city" required minLength={2} maxLength={60} autoComplete="address-level2" placeholder="Москва" defaultValue={saved?.city || ''}/></label>
      <label>Улица *<input name="street" required minLength={2} maxLength={60} autoComplete="address-line1" placeholder="Название улицы" defaultValue={saved?.street || ''}/></label>
      <label>Дом *<input name="house" required maxLength={30} placeholder="Номер дома" defaultValue={saved?.house || ''}/></label>
      <label>Корпус / строение<input name="building" maxLength={10} defaultValue={saved?.building || ''}/></label>
    </div> : <label>Адрес *<input name="line1" required minLength={10} maxLength={250} autoComplete="street-address" placeholder="Город, улица, дом" defaultValue={saved?.line1 || ''}/></label>}
    <div className="form-grid">
      <label>Квартира / офис<input name="flat" maxLength={10} defaultValue={saved?.flat || ''}/></label>
      <label>Подъезд<input name="entrance" maxLength={10} defaultValue={saved?.entrance || ''}/></label>
      <label>Этаж<input name="floor" maxLength={10} defaultValue={saved?.floor || ''}/></label>
      <label>Домофон<input name="doorphone" maxLength={10} defaultValue={saved?.doorphone || ''}/></label>
    </div>
    <p className="field-hint">Тестовая доставка: адрес будет передан на кассу вместе с заказом. Выезд курьера не организуется.</p>
  </>;
}

export default function IikoCheckout() {
  const shop = useShop();
  const { cart, user, setUser, checkoutAttempt: attempt, setCheckoutAttempt, checkoutStorageError, catalogStatus, catalogError, orderingEnabled, ordering, refreshCatalog, saveOrder, clearAcceptedCart, deliveryMethod: method, setDeliveryMethod: setMethod } = shop;
  const [error, setError] = useState('');
  const methods = ordering?.methods || ['pickup'];
  const addressFormat = ordering?.addressFormat || 'legacy';
  const methodAvailable = methods.includes(method);
  const [busy, setBusy] = useState(false);
  const [pollExpired, setPollExpired] = useState(false);
  const activeRequest = useRef(false);
  const currentAttempt = useRef(attempt);
  const alive = useRef(true);
  currentAttempt.current = attempt;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  function acceptResult(data, sentAttempt) {
    const result = validateOrderResult(data, sentAttempt.requestId);
    const latest = currentAttempt.current?.requestId === sentAttempt.requestId ? currentAttempt.current : sentAttempt;
    const next = { ...latest, result };
    if (result.status === 'accepted') next.cartCleared = true;
    if (!setCheckoutAttempt(next, sentAttempt.requestId)) return;
    currentAttempt.current = next;
    if (result.status === 'accepted') {
      if (!latest.cartCleared) clearAcceptedCart();
      const items = result.items.map(item => ({ ...sentAttempt.snapshotItems.find(saved => (saved.lineId || saved.id) === (item.lineId || item.id)), ...item, source: 'iiko' }));
      saveOrder({ ...result, items, source: 'iiko', method: sentAttempt.payload.method, address: addressLabel(sentAttempt.payload.address), deliveryFee: 0, payment: 'cash_on_receipt', name: sentAttempt.payload.customer.name, phone: sentAttempt.payload.customer.phone });
    }
    if (alive.current) setError('');
    return result.status;
  }

  async function checkStatus(saved = currentAttempt.current) {
    if (!saved?.requestId || activeRequest.current) return;
    activeRequest.current = true;
    if (alive.current) setBusy(true);
    try {
      const result = await apiRequest(`/api/orders/${encodeURIComponent(saved.requestId)}`, { token: saved.token });
      return acceptResult(result, saved);
    } catch (failure) {
      if (alive.current) setError('Состояние заказа пока не подтверждено. Корзина сохранена. Повторите проверку; новый заказ создавать не нужно.');
    } finally {
      activeRequest.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function sendAttempt(saved) {
    if (activeRequest.current) return;
    activeRequest.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest('/api/orders', { method: 'POST', token: saved.token, body: saved.payload });
      acceptResult(result, saved);
    } catch (failure) {
      if (SAFE_REJECTION_CODES.has(failure.code)) {
        try {
          if (!setCheckoutAttempt(null, saved.requestId)) return;
          currentAttempt.current = null;
          await refreshCatalog();
          if (alive.current) setError(failure.message || 'Не удалось оформить заказ. Проверьте корзину.');
        } catch {
          if (alive.current) setError('Не удалось сохранить результат проверки. Повторите проверку заказа.');
        }
      } else if (alive.current) setError('Подтверждение пока не получено. Корзина сохранена. Проверьте заказ или повторите передачу этого же заказа.');
    } finally {
      activeRequest.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const requestId = attempt?.requestId;
  const status = attempt?.result?.status;
  useEffect(() => {
    if (!requestId || status === 'accepted' || status === 'failed') return;
    let stopped = false;
    let timer;
    const deadline = Date.now() + 60_000;
    setPollExpired(false);
    const poll = async () => {
      if (stopped) return;
      if (Date.now() >= deadline) { setPollExpired(true); return; }
      await checkStatus();
      if (!stopped) timer = setTimeout(poll, 2500);
    };
    poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [requestId, status]);

  function submit(event) {
    event.preventDefault();
    if (activeRequest.current || currentAttempt.current) return;
    if (!orderingEnabled || catalogStatus !== 'ready') return setError('Оформление заказов сейчас недоступно. Обновите меню и повторите.');
    if (!methodAvailable) return setError('Этот способ получения сейчас недоступен. Выберите другой.');
    if (!cart.length || cart.some(item => item.available === false)) return setError('В корзине есть недоступные блюда. Измените состав заказа.');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const name = values.name.trim();
    const phone = normalizePhone(values.phone);
    if (name.length < 2) return setError('Введите имя, минимум два символа.');
    if (!phone) return setError('Укажите телефон в формате +7 (999) 123-45-67.');
    let address;
    if (method === 'delivery') {
      const keys = addressFormat === 'legacy' ? ['city', 'street', 'house', 'building', 'flat', 'entrance', 'floor', 'doorphone'] : ['line1', 'flat', 'entrance', 'floor', 'doorphone'];
      address = { type: addressFormat, ...Object.fromEntries(keys.map(key => [key, String(values[key] || '').trim()]).filter(([, value]) => value)) };
      if (addressFormat === 'legacy' ? !address.city || !address.street || !address.house : !address.line1) return setError('Заполните адрес доставки.');
    }
    try {
      const saved = createCheckoutAttempt({ cart, customer: { name, phone }, comment: values.comment.trim(), method, address });
      if (!setCheckoutAttempt(saved)) return setError('Не удалось сохранить заказ. Обновите страницу и проверьте его состояние.');
      currentAttempt.current = saved;
      setUser({ ...(user?.phone === phone ? user : {}), name, phone, ...(address ? { address: addressLabel(address), addressDetails: address } : {}) });
      sendAttempt(saved);
    } catch (failure) { setError(failure.message || 'Не удалось подготовить заказ. Повторите попытку.'); }
  }

  function finishAttempt() {
    try { if (setCheckoutAttempt(null, attempt?.requestId, { clearTerminal: true })) { currentAttempt.current = null; setError(''); } } catch (failure) { setError(failure.message); }
  }

  if (attempt?.invalid) return <main className="container confirmation-page iiko-checkout"><h1>Не удалось восстановить заказ</h1><p role="alert">Сохранённое состояние заказа недоступно. Прежде чем оформлять другой заказ, уточните в демо-кафе, был ли принят предыдущий.</p></main>;
  if (attempt) {
    const result = attempt.result;
    const accepted = result?.status === 'accepted';
    const failed = result?.status === 'failed';
    return <main className="container checkout-page iiko-checkout"><span className="eyebrow">ТЕСТОВЫЙ ЗАКАЗ В ДЕМО-КАФЕ</span><h1>{accepted ? 'Заказ принят' : failed ? 'Заказ не принят' : 'Проверяем заказ'}</h1><div className="checkout-layout"><section className="order-progress" aria-live="polite">
      {accepted && <div className="success-icon"><Check size={32}/></div>}
      <p>{accepted ? `Демо-кафе подтвердило заказ${result.number ? ` № ${result.number}` : ''}. Это тестовый заказ.` : failed ? result.message || 'Демо-кафе не смогло принять заказ. Корзина сохранена.' : 'Подтверждения от демо-кафе пока нет. Корзина сохранена; повторное оформление не требуется.'}</p>
      {error && <p className="form-error" role="alert">{error}</p>}{checkoutStorageError && <p className="form-error" role="alert">{checkoutStorageError}</p>}
      {pollExpired && !accepted && !failed && <p>Автоматическая проверка завершена. Результат ещё не известен. Проверьте состояние кнопкой ниже.</p>}
      {!accepted && !failed && <div className="order-status-actions"><button className="button" disabled={busy} onClick={() => checkStatus()}>{busy ? 'Проверяем…' : 'Проверить состояние'}</button><button className="button-outline" disabled={busy} onClick={() => sendAttempt(currentAttempt.current)}>Повторить передачу этого заказа</button></div>}
      {(accepted || failed) && <div className="order-status-actions"><button className="button" onClick={finishAttempt}>{accepted ? 'Оформить новый заказ' : 'Вернуться к корзине'}</button><Link to="/account" className="text-link">История в этом браузере <ArrowUpRight size={18}/></Link></div>}
      <p className="field-hint">{attempt.payload.method === 'delivery' ? 'Доставка' : 'Самовывоз'} · наличными при получении. Деньги через сайт не списываются.</p>
    </section><Summary items={attempt.snapshotItems} total={result?.total ?? attempt.payload.expectedTotal} method={attempt.payload.method} address={attempt.payload.address}/></div></main>;
  }
  if (!cart.length) return <main className="container confirmation-page iiko-checkout"><ShoppingBag size={46}/><h1>В корзине пока нет блюд</h1><Link to="/delivery" className="button">Перейти в меню <ArrowUpRight size={20}/></Link></main>;
  const cannotSubmit = busy || !orderingEnabled || catalogStatus !== 'ready' || !methodAvailable || cart.some(item => item.available === false);
  return <main className="container checkout-page iiko-checkout" data-reveal-group>
    <Link className="back-link" to="/delivery" data-reveal="soft"><ArrowLeft size={17}/> Вернуться в меню</Link>
    <span className="eyebrow" data-reveal="rise">ПОЧТИ ЗА СТОЛОМ</span><h1 data-reveal="rise">Оформление заказа</h1>
    <div className="checkout-layout"><form onSubmit={submit} className="checkout-form" data-reveal="soft">
      <div className="demo-notice">Тестовый заказ будет передан на кассу демо-кафе. Используйте тестовые данные. Акции и промокоды в тесте не применяются.</div>
      <h2>Как вам удобнее?</h2><div className="segmented">
        <button type="button" className={method === 'delivery' ? 'active' : ''} disabled={!methods.includes('delivery')} aria-pressed={method === 'delivery'} onClick={() => setMethod('delivery')}>Доставка</button>
        <button type="button" className={method === 'pickup' ? 'active' : ''} disabled={!methods.includes('pickup')} aria-pressed={method === 'pickup'} onClick={() => setMethod('pickup')}>Заберу сам</button>
      </div>
      <h2>Ваши контакты</h2><div className="form-grid"><label>Имя *<input name="name" required minLength={2} maxLength={60} autoComplete="given-name" placeholder="Как к вам обращаться" defaultValue={user?.name || ''}/></label><label>Телефон *<RussianPhoneInput defaultValue={user?.phone}/></label></div>
      {method === 'delivery' ? <AddressFields format={addressFormat} saved={user?.addressDetails}/> : <div className="pickup-address"><MapPin size={20}/><div>Самовывоз из демо-кафе<span>Место и время выдачи уточняются в кафе.</span></div></div>}
      <label>Комментарий к заказу<textarea name="comment" maxLength={500} placeholder="Пожелания к заказу" rows={3}/></label>
      <h2>Оплата</h2><div className="payment-demo"><CircleDot size={18} aria-hidden="true"/> Наличными при получении</div>
      <p className="field-hint">В тесте оплачиваются только блюда. Онлайн-оплата не выполняется.</p>
      <label className="checkbox-label"><input type="checkbox" required/><span>Я понимаю, что это тестовый заказ, и согласен с <Link to="/privacy">условиями обработки данных</Link>.</span></label>
      {catalogStatus === 'loading' && <p role="status">Обновляем меню…</p>}{catalogStatus === 'error' && <p className="form-error" role="alert">{catalogError}</p>}
      {catalogStatus === 'ready' && !orderingEnabled && <p className="form-error">Приём заказов сейчас недоступен.</p>}
      {!methodAvailable && <p className="form-error">Выберите доступный способ получения заказа.</p>}
      {(error || checkoutStorageError) && <p className="form-error" role="alert">{error || checkoutStorageError}</p>}
      {cart.some(item => item.available === false) && <p className="form-error">Удалите недоступные блюда из корзины перед оформлением.</p>}
      <div className="order-status-actions"><button className="button submit-order" type="submit" disabled={cannotSubmit}>Отправить в демо-кафе</button><button type="button" className="button-outline" disabled={catalogStatus === 'loading'} onClick={() => refreshCatalog()}>Обновить меню и цены</button></div>
    </form><Summary items={cart} total={cartTotal(cart)} method={method} editable/></div>
  </main>;
}
