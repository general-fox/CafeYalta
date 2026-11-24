import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Check, CircleDot, ShoppingBag } from 'lucide-react';
import { useShop } from '../store';
import { cartTotal, money, normalizePhone } from '../domain';
import { apiRequest, createCheckoutAttempt, SAFE_REJECTION_CODES, validateOrderResult } from '../iiko';
import { Quantity } from '../components';
import FoodImage from '../FoodImage';

function Summary({ items, total, editable = false }) {
  return <aside className="checkout-summary"><h2>Ваш заказ</h2>{items.map(item => <div className="checkout-item" key={item.id}><FoodImage product={{ ...item, source: 'iiko' }} alt=""/><div><h3>{item.name}</h3>{editable ? <Quantity product={item} quantity={item.quantity}/> : <span>{item.quantity} порц.</span>}{item.available === false && <p className="availability-note">{item.unavailableReason || 'Сейчас недоступно'}</p>}</div><strong>{money(item.price * item.quantity)}</strong></div>)}<div className="summary-line grand-total"><span>Итого</span><strong>{money(total)}</strong></div><small>Самовывоз · наличными при получении</small></aside>;
}

export default function IikoCheckout() {
  const shop = useShop();
  const { cart, user, setUser, checkoutAttempt: attempt, setCheckoutAttempt, checkoutStorageError, catalogStatus, catalogError, orderingEnabled, refreshCatalog, saveOrder, clearAcceptedCart } = shop;
  const [error, setError] = useState('');
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
      const items = result.items.map(item => ({ ...sentAttempt.snapshotItems.find(saved => saved.id === item.id), ...item, source: 'iiko' }));
      saveOrder({ ...result, items, source: 'iiko', method: 'pickup', payment: 'cash_on_receipt', name: sentAttempt.payload.customer.name, phone: sentAttempt.payload.customer.phone });
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
    if (!cart.length || cart.some(item => item.available === false)) return setError('В корзине есть недоступные блюда. Измените состав заказа.');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const name = values.name.trim();
    const phone = normalizePhone(values.phone);
    if (name.length < 2) return setError('Введите имя, минимум два символа.');
    if (!phone) return setError('Укажите телефон в формате +7 (999) 123-45-67.');
    try {
      const saved = createCheckoutAttempt({ cart, customer: { name, phone }, comment: values.comment.trim() });
      setCheckoutAttempt(saved);
      currentAttempt.current = saved;
      setUser({ name, phone });
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
      <p className="field-hint">Самовывоз · наличными при получении. Деньги через сайт не списываются.</p>
    </section><Summary items={attempt.snapshotItems} total={result?.total ?? attempt.payload.expectedTotal}/></div></main>;
  }
  if (!cart.length) return <main className="container confirmation-page iiko-checkout"><ShoppingBag size={46}/><h1>В корзине пока нет блюд</h1><Link to="/delivery" className="button">Перейти в меню <ArrowUpRight size={20}/></Link></main>;
  return <main className="container checkout-page iiko-checkout"><Link className="back-link" to="/delivery"><ArrowLeft size={17}/> Вернуться в меню</Link><span className="eyebrow">САМОВЫВОЗ</span><h1>Оформление заказа</h1><div className="checkout-layout"><form onSubmit={submit} className="checkout-form"><div className="demo-notice">Тестовый заказ в демо-кафе: самовывоз и наличные при получении. Акции и промокоды в тестовом заказе не применяются. После отправки дождитесь подтверждения.</div><h2>Ваши контакты</h2><div className="form-grid"><label>Имя *<input name="name" required minLength={2} maxLength={60} autoComplete="given-name" defaultValue={user?.name || ''}/></label><label>Телефон *<input name="phone" type="tel" required autoComplete="tel" placeholder="+7 (999) 123-45-67" defaultValue={user?.phone || ''}/></label></div><label>Комментарий<textarea name="comment" maxLength={500} rows={3}/></label><h2>Получение и оплата</h2><div className="payment-demo"><CircleDot size={18}/> Самовывоз · наличными при получении</div><p className="field-hint">Без минимальной суммы. Место и время выдачи уточните в демо-кафе.</p><label className="checkbox-label"><input type="checkbox" required/><span>Я понимаю, что это тестовый заказ, и согласен с <Link to="/privacy">условиями обработки данных</Link>.</span></label>
    {catalogStatus === 'loading' && <p role="status">Обновляем меню…</p>}{catalogStatus === 'error' && <p className="form-error" role="alert">{catalogError}</p>}{catalogStatus === 'ready' && !orderingEnabled && <p className="form-error">Приём заказов сейчас недоступен.</p>}
    {(error || checkoutStorageError) && <p className="form-error" role="alert">{error || checkoutStorageError}</p>}
    {cart.some(item => item.available === false) && <p className="form-error">Удалите недоступные блюда из корзины перед оформлением.</p>}
    <div className="order-status-actions"><button className="button submit-order" type="submit" disabled={busy || !orderingEnabled || cart.some(item => item.available === false)}>Отправить в демо-кафе <ArrowUpRight size={20}/></button><button type="button" className="button-outline" disabled={catalogStatus === 'loading'} onClick={() => refreshCatalog()}>Обновить меню и цены</button></div>
  </form><Summary items={cart} total={cartTotal(cart)} editable/></div></main>;
}
