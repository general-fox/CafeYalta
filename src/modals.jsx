import { useEffect, useId, useRef, useState } from 'react';
import FoodImage from './FoodImage';
import RussianPhoneInput from './RussianPhoneInput';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, Check, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useShop } from './store';
import { Modal, asset, ModifierSummary, Quantity, Waves } from './components';
import { cartTotal, getOrderGift, money, normalizePhone, today, validReservation } from './domain';
import { defaultModifierSelection, evaluateModifierSelection } from '../shared/modifiers.mjs';
function Booking() {
  const { setModal, saveReservation, user } = useShop(); const [date, setDate] = useState(today()); const [time, setTime] = useState(''); const [error, setError] = useState(''); const [done, setDone] = useState(false);
  const slots = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','18:30','19:00','19:30','20:00','20:30','21:00','21:30','22:00'];
  const submit = e => { e.preventDefault(); const values = Object.fromEntries(new FormData(e.currentTarget)); if (values.name.trim().length < 2) return setError('Введите имя, минимум два символа.'); const phone = normalizePhone(values.phone); if (!phone) return setError('Проверьте российский номер телефона.'); const selectedDate = values.date; if (!time || !validReservation(selectedDate, time)) return setError('Выберите доступное время в будущем.'); saveReservation({ ...values, phone, id: 'Б-' + Date.now().toString().slice(-6), date: selectedDate, time, guests: Number(values.guests), status: 'demo' }); setDate(selectedDate); setDone(true); };
  return <Modal title={done ? 'До скорой встречи' : 'Забронировать стол'} onClose={() => setModal(null)} className="booking-modal">{done ? <div className="booking-success"><div className="success-icon"><Check size={28}/></div><h3>Тестовая заявка сохранена</h3><p>{new Date(date + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · {time}</p><div className="demo-notice">Это пример бронирования. Кафе не получило заявку и не подтвердило столик. Заявка хранится только в этом браузере.</div><button className="button" onClick={() => setModal(null)}>Понятно</button><Waves/></div> : <><span className="eyebrow">МОСКВА · ЖК «ИСПАНСКИЕ КВАРТАЛЫ»</span><form onSubmit={submit}><div className="form-grid"><label>Имя *<input name="name" required minLength={2} maxLength={60} placeholder="Ваше имя" defaultValue={user?.name || ''} autoComplete="given-name"/></label><label>Фамилия<input name="surname" maxLength={60} placeholder="Ваша фамилия" autoComplete="family-name"/></label></div><label>Телефон *<RussianPhoneInput defaultValue={user?.phone}/></label><div className="form-grid"><label>Дата *<input type="date" name="date" required min={today()} value={date} onInput={e => { setDate(e.currentTarget.value); setTime(''); }} onChange={e => { setDate(e.target.value); setTime(''); }}/></label><label>Количество гостей *<select name="guests" defaultValue="2">{[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} {n === 1 ? 'гость' : n < 5 ? 'гостя' : 'гостей'}</option>)}</select></label></div><fieldset className="time-field"><legend>Время *</legend><div className="time-slots">{slots.map(t => <button type="button" key={t} disabled={!validReservation(date, t)} className={time === t ? 'active' : ''} onClick={() => setTime(t)} aria-pressed={time === t}>{t}</button>)}</div></fieldset><label>Ваши пожелания<textarea name="comment" maxLength={400} rows={2} placeholder="Например, столик у окна или детский стульчик"/></label><label className="checkbox-label"><input type="checkbox" required/><span>Согласен с <Link onClick={() => setModal(null)} to="/privacy">условиями обработки данных</Link>.</span></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button full-width" type="submit">Оставить тестовую заявку <ArrowUpRight size={18}/></button><p className="field-hint">Демо-режим: заявка не отправляется в кафе. Не вводите реальные данные.</p></form></>}</Modal>;
}
function Auth() { const { setModal, setUser, user, notify } = useShop(); const [error, setError] = useState(''); const submit = e => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget)); if (data.name.trim().length < 2) return setError('Введите имя, минимум два символа.'); const phone = normalizePhone(data.phone); if (!phone) return setError('Проверьте российский номер телефона.'); setUser({ ...(user?.phone === phone ? user : {}), name: data.name.trim(), phone }); setModal(null); notify('Демонстрационный профиль готов'); }; return <Modal title="Хорошо, когда вас знают" onClose={() => setModal(null)} className="auth-modal"><p className="modal-intro">Все любимые блюда, адреса и заказы — в вашем личном кабинете.</p><div className="demo-notice">Пока это демо-кабинет на одном устройстве. SMS не отправляется, телефон не подтверждается. Используйте тестовые данные.</div><form onSubmit={submit}><label>Как вас зовут?<input name="name" required minLength={2} maxLength={60} placeholder="Ваше имя" autoComplete="given-name"/></label><label>Телефон<RussianPhoneInput/></label><label className="checkbox-label"><input type="checkbox" required/><span>Согласен с <Link onClick={() => setModal(null)} to="/privacy">условиями обработки данных</Link>.</span></label>{error && <p className="form-error" role="alert">{error}</p>}<button type="submit" className="button full-width">Открыть демо-кабинет <ArrowUpRight size={18}/></button></form></Modal>; }
function Cart() {
  const { cart, setCart, setModal, deliveryMethod, isIiko, orderLocked } = useShop();
  const menuLink = useRef(null);
  useEffect(() => { if (!cart.length) menuLink.current?.focus(); }, [cart.length]);
  const total = cartTotal(cart);
  const gift = isIiko ? null : getOrderGift(cart, deliveryMethod);
  return <Modal title="Ваш маленький отпуск" onClose={() => setModal(null)} className="cart-modal">{cart.length ? <>
    <p className="modal-intro">Любимые блюда уже в корзине.</p>
    {orderLocked && <div className="demo-notice">Заказ проверяется. Корзина временно недоступна для изменений.</div>}
    <div className="cart-items">{cart.map(item => <div className="cart-item" key={item.lineId || item.id}><FoodImage product={item} alt=""/><div><h3>{item.name}</h3><span>{item.weight}</span><ModifierSummary modifiers={item.modifiers}/>{isIiko && item.modifierGroups?.length > 0 && !item.modifiers?.length && <p className="modifier-empty-summary">Без дополнений</p>}{isIiko && (item.modifierGroups?.length > 0 || item.selections?.length > 0) && <button type="button" className="modifier-edit" disabled={orderLocked} onClick={() => setModal({ type: 'product', product: item, editingLineId: item.lineId || item.id, returnTo: 'cart' })}>Изменить состав</button>}{item.available === false && <p className="availability-note">{item.unavailableReason || 'Сейчас недоступно'}</p>}<Quantity product={item} quantity={item.quantity}/></div><div><strong>{money(item.price * item.quantity)}</strong><button type="button" disabled={orderLocked} onClick={() => setCart(previous => previous.filter(product => (product.lineId || product.id) !== (item.lineId || item.id)))} className="icon-button remove-item" aria-label={`Удалить: ${item.name}`}><Trash2 size={17}/></button></div></div>)}</div>
    {gift && <div className="gift-line" aria-live="polite"><FoodImage product={gift} alt=""/><div><strong>Морс в подарок · 0 ₽</strong><span>Клюква — гибискус · {gift.weight}</span></div></div>}
    <div className="summary-line grand-total"><span>Блюда</span><strong>{money(total)}</strong></div>
    <Link className="button full-width" to="/checkout" onClick={() => setModal(null)}>{orderLocked ? 'Проверить заказ' : 'Перейти к оформлению'} <ArrowUpRight size={20}/></Link>
    <p className="field-hint">{isIiko ? 'Способ получения выберите при оформлении.' : 'Стоимость доставки рассчитается на следующем шаге.'}</p>
  </> : <div className="empty-state"><ShoppingBag size={48} strokeWidth={1}/><h3>Здесь скоро будет вкусно</h3><p>Выберите что-нибудь из нашего меню.</p><Link ref={menuLink} className="button" to="/delivery" onClick={() => setModal(null)}>Посмотреть меню <ArrowUpRight size={18}/></Link></div>}</Modal>;
}
function ModifierChoices({ groups, selections, onChange, disabled }) {
  const prefix = useId();
  const amount = (groupId, modifierId) => selections.find(item => item.groupId === groupId && item.modifierId === modifierId)?.quantity || 0;
  function choose(group, item, quantity, single = false) {
    onChange(previous => [
      ...previous.filter(selection => single ? selection.groupId !== group.id : selection.groupId !== group.id || selection.modifierId !== item.id),
      ...(quantity > 0 ? [{ groupId: group.id, modifierId: item.id, quantity }] : []),
    ]);
  }
  return <div className="modifier-groups">{groups.map((group, groupIndex) => {
    const count = selections.filter(item => item.groupId === group.id).reduce((sum, item) => sum + item.quantity, 0);
    const single = group.maxQuantity === 1;
    const groupId = `${prefix}-${groupIndex}`;
    const range = group.minQuantity === group.maxQuantity ? `Выберите ${group.minQuantity}`
      : group.minQuantity > 0 ? `Выберите от ${group.minQuantity} до ${group.maxQuantity}`
      : single ? 'Можно выбрать один вариант' : `Можно выбрать до ${group.maxQuantity}`;
    const countValid = count >= group.minQuantity && count <= group.maxQuantity;
    return <fieldset className="modifier-group" key={group.id} aria-describedby={`${groupId}-hint`}>
      <legend>{group.name}<span className="modifier-requirement">{group.required || group.minQuantity > 0 || group.items.some(item => item.minQuantity > 0) ? 'Обязательно' : 'На ваш вкус'}</span></legend>
      <div className="modifier-group-hint" id={`${groupId}-hint`}><span>{range}</span><span className={countValid ? 'is-valid' : ''} aria-live="polite">Выбрано: {count}</span></div>
      <div className="modifier-options">
        {single && group.minQuantity === 0 && <label className={`modifier-option${count === 0 ? ' is-selected' : ''}`}>
          <input type="radio" name={groupId} checked={count === 0} disabled={disabled} onChange={() => onChange(previous => previous.filter(item => item.groupId !== group.id))}/><span className="modifier-option-copy"><strong>Без дополнений</strong></span>
        </label>}
        {group.items.map((item, itemIndex) => {
          const quantity = amount(group.id, item.id);
          const itemId = `${groupId}-${itemIndex}`;
          const canIncrease = !disabled && item.available !== false && quantity < item.maxQuantity && count < group.maxQuantity;
          const price = item.price === 0 ? 'Без доплаты' : `+${money(item.price)}`;
          const copy = <span className="modifier-option-copy" id={`${itemId}-label`}><strong>{item.name}</strong><span className="modifier-option-price">{price}{item.defaultQuantity > 0 && <span className="modifier-default">По умолчанию</span>}</span>{item.minQuantity > 0 && <span className="modifier-item-requirement">{item.minQuantity > 1 ? `Обязательно · минимум ${item.minQuantity} шт.` : 'Обязательно'}</span>}</span>;
          if (single || item.maxQuantity === 1) return <label key={item.id} className={`modifier-option${quantity > 0 ? ' is-selected' : ''}${item.available === false ? ' is-unavailable' : ''}`}>
            <input type={single ? 'radio' : 'checkbox'} name={single ? groupId : undefined} checked={quantity > 0} disabled={disabled || (!quantity && (item.available === false || item.maxQuantity < 1 || (!single && !canIncrease)))}
              onChange={event => choose(group, item, event.target.checked ? 1 : 0, single)}/>{copy}
          </label>;
          return <div key={item.id} className={`modifier-option modifier-option-counter${quantity > 0 ? ' is-selected' : ''}`}>
            {copy}<div className="modifier-counter" role="group" aria-labelledby={`${itemId}-label`}>
              <button type="button" disabled={disabled || quantity <= 0} onClick={() => choose(group, item, quantity - 1)} aria-label={`Убрать: ${item.name}`}><Minus size={16}/></button>
              <output aria-live="polite">{quantity}</output>
              <button type="button" disabled={!canIncrease} onClick={() => choose(group, item, quantity + 1)} aria-label={`Добавить: ${item.name}`}><Plus size={16}/></button>
            </div>
          </div>;
        })}
      </div>
    </fieldset>;
  })}</div>;
}

function Product({ product: selected, editingLineId, returnTo }) {
  const { setModal, add, addConfigured, cart, products, isIiko, orderLocked, orderingEnabled } = useShop();
  const product = isIiko ? products.find(item => item.id === selected.id) || { ...selected, available: false } : selected;
  const quantity = cart.find(item => item.id === product.id)?.quantity || 0;
  const configurable = isIiko && (product.modifierGroups?.length > 0 || (editingLineId && selected.selections?.length > 0));
  const [selections, setSelections] = useState(() => editingLineId && Array.isArray(selected.selections)
    ? selected.selections.map(item => ({ ...item })) : defaultModifierSelection(product));
  const configuration = configurable ? evaluateModifierSelection(product, selections) : null;
  const unavailable = product.available === false || (isIiko && product.source !== 'iiko');
  const allergens = Array.isArray(product.allergens) ? product.allergens.join(', ') : product.allergens;
  const disabled = unavailable || orderLocked || (isIiko && !orderingEnabled);
  function saveConfiguration() {
    if (disabled || !configuration?.valid) return;
    if (addConfigured(product, configuration.selections, editingLineId ? selected.quantity || 1 : 1, editingLineId)) setModal(returnTo === 'cart' ? 'cart' : null);
  }
  return <Modal title={product.name} onClose={() => setModal(null)} className={`product-modal${configurable ? ' product-modifier-modal' : ''}`}><FoodImage className="product-modal-image" product={product} variant="detail"/><div className="product-modal-content"><span className="eyebrow">{product.weight}</span><p>{product.description}</p>
    {configurable && <><p className="modifier-intro">{editingLineId ? 'Измените дополнения к этой позиции.' : 'Добавьте то, что любите. Состав выбирается для каждой порции.'}</p><ModifierChoices groups={product.modifierGroups || []} selections={selections} onChange={setSelections} disabled={disabled}/><button type="button" className="modifier-edit" disabled={disabled} onClick={() => setSelections(defaultModifierSelection(product))}>Вернуть выбор по умолчанию</button></>}
    <p className="allergens">Аллергены: {allergens || 'уточните в кафе'}.<br/>{isIiko ? 'При аллергии уточните состав у сотрудников кафе.' : 'Состав демонстрационный; при аллергии уточните информацию у сотрудников кафе.'}</p>{unavailable && <p className="availability-note">{product.unavailableReason || 'Сейчас недоступно'}</p>}
    {configurable && <div className="modifier-selection-summary"><span>Ваш выбор</span>{configuration.selectedModifiers.length ? <ModifierSummary modifiers={configuration.selectedModifiers}/> : <p>Без дополнений</p>}{!configuration.valid && <p className="modifier-validation" role="status">{configuration.errors[0] || 'Проверьте выбранные дополнения.'}</p>}</div>}
    <div className="product-modal-bottom"><strong aria-live="polite">{money(configuration?.unitPrice ?? product.price)}{configurable && <small>за одну порцию</small>}</strong>{configurable ? <button type="button" className="button" disabled={disabled || !configuration.valid} onClick={saveConfiguration}>{editingLineId ? 'Сохранить состав' : 'Добавить в корзину'}<ShoppingBag size={18}/></button> : quantity ? <Quantity product={product} quantity={quantity}/> : <button className="button" disabled={disabled} onClick={() => add(product)}>{unavailable ? 'Сейчас недоступно' : 'Добавить в корзину'} <ShoppingBag size={18}/></button>}</div></div></Modal>;
}
function IikoAccountNotice() {
  const { setModal } = useShop();
  return <Modal title="Ваши заказы" onClose={() => setModal(null)} className="auth-modal"><p className="modal-intro">История тестовых заказов сохраняется в этом браузере.</p><p>Имя, телефон и адрес можно указать при оформлении заказа.</p><Link className="button full-width" to="/account" onClick={() => setModal(null)}>Открыть историю <ArrowUpRight size={18}/></Link></Modal>;
}
export default function Modals() { const { modal, isIiko } = useShop(); if (!modal) return null; if (modal === 'booking') return <Booking/>; if (modal === 'auth') return isIiko ? <IikoAccountNotice/> : <Auth/>; if (modal === 'cart') return <Cart/>; if (modal.type === 'product') return <Product key={`${modal.product.id}:${modal.editingLineId || 'new'}`} product={modal.product} editingLineId={modal.editingLineId} returnTo={modal.returnTo}/>; return null; }
