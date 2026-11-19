import test from 'node:test';
import assert from 'node:assert/strict';
import {
  money,
  cartTotal,
  changeQuantity,
  deliveryFee,
  getOrderGift,
  getOrderItems,
  normalizePhone,
  formatPhone,
  validReservation,
} from '../src/domain.js';
import { products } from '../src/data.js';

const breakfast = Object.freeze({ id: 'breakfast', name: 'Сырники', price: 490 });
const salad = Object.freeze({ id: 'salad', name: 'Салат', price: 650 });

test('суммы отображаются по-русски с рублём и разделителем тысяч', () => {
  assert.equal(money(0), '0 ₽');
  assert.equal(money(2500), '2\u00a0500 ₽');
  assert.equal(money(1250.5), '1\u00a0250,5 ₽');
});

test('пустая корзина имеет нулевую стоимость', () => {
  assert.equal(cartTotal([]), 0);
});

test('стоимость корзины учитывает количество каждой позиции', () => {
  assert.equal(cartTotal([
    { ...breakfast, quantity: 2 },
    { ...salad, quantity: 3 },
  ]), 2930);
});

test('добавление нового блюда сохраняет существующую корзину', () => {
  const initialItem = Object.freeze({ ...breakfast, quantity: 2 });
  const original = Object.freeze([initialItem]);
  const updated = changeQuantity(original, salad, 1);

  assert.deepEqual(updated, [initialItem, { ...salad, quantity: 1 }]);
  assert.deepEqual(original, [initialItem]);
  assert.notEqual(updated, original);
  assert.equal(cartTotal(updated), 1630);
});

test('повторное добавление меняет количество, не создавая вторую строку', () => {
  const original = Object.freeze([Object.freeze({ ...breakfast, quantity: 1 })]);
  const updated = changeQuantity(original, breakfast, 2);

  assert.equal(updated.length, 1);
  assert.equal(updated[0].quantity, 3);
  assert.equal(original[0].quantity, 1);
  assert.equal(cartTotal(updated), 1470);
});

test('уменьшение количества пересчитывает заказ', () => {
  const updated = changeQuantity([{ ...breakfast, quantity: 3 }], breakfast, -1);
  assert.equal(updated[0].quantity, 2);
  assert.equal(cartTotal(updated), 980);
});

test('последняя порция удаляет блюдо, сохраняя остальные позиции', () => {
  const original = [{ ...breakfast, quantity: 1 }, { ...salad, quantity: 2 }];
  assert.deepEqual(changeQuantity(original, breakfast, -1), [{ ...salad, quantity: 2 }]);
  assert.deepEqual(changeQuantity(original, breakfast, -10), [{ ...salad, quantity: 2 }]);
});

test('неизвестная позиция не добавляется при уменьшении количества', () => {
  const original = [{ ...breakfast, quantity: 1 }];
  assert.deepEqual(changeQuantity(original, salad, -1), original);
  assert.deepEqual(changeQuantity(original, salad, 0), original);
});

test('лимит 30 порций действует для новых и существующих блюд', () => {
  assert.equal(changeQuantity([], breakfast, 99)[0].quantity, 30);
  assert.equal(changeQuantity([{ ...breakfast, quantity: 29 }], breakfast, 2)[0].quantity, 30);
  assert.equal(changeQuantity([{ ...breakfast, quantity: 30 }], breakfast, 1)[0].quantity, 30);
});

test('доставка стоит 199 рублей независимо от суммы заказа', () => {
  for (const subtotal of [800, 2499, 2500, 3000, 10000]) {
    assert.equal(deliveryFee(subtotal, 'delivery'), 199);
  }
});

test('самовывоз бесплатный независимо от суммы блюд', () => {
  for (const amount of [0, 490, 2499, 2500]) {
    assert.equal(deliveryFee(amount, 'pickup'), 0);
  }
});

test('один литр морса добавляется в подарок начиная ровно с 2000 рублей доставки', () => {
  const cartAt = price => [{ ...breakfast, price, quantity: 1 }];
  assert.equal(getOrderGift(cartAt(1999), 'delivery'), null);
  const drink = products.find(product => product.id === 'dr2');
  for (const subtotal of [2000, 2500, 10000]) {
    assert.deepEqual(getOrderGift(cartAt(subtotal), 'delivery'), {
      ...drink, price: 0, quantity: 1, isGift: true,
    });
  }
});

test('подарок недоступен при самовывозе, пустой корзине и неизвестном способе получения', () => {
  const cart = [{ ...breakfast, price: 3000, quantity: 1 }];
  assert.equal(getOrderGift(cart, 'pickup'), null);
  assert.equal(getOrderGift(cart, undefined), null);
  assert.equal(getOrderGift([], 'delivery'), null);
});

test('подарок не изменяет корзину, каталог или сумму заказа и не отменяет платную доставку', () => {
  const original = Object.freeze([Object.freeze({ ...breakfast, price: 2000, quantity: 1 })]);
  const drink = products.find(product => product.id === 'dr2');
  const originalDrink = { ...drink };
  const items = getOrderItems(original, 'delivery');
  assert.equal(original.length, 1);
  assert.notEqual(items[0], original[0]);
  assert.equal(items.length, 2);
  assert.equal(items[1].isGift, true);
  assert.equal(items[1].quantity, 1);
  assert.equal(cartTotal(items), 2000);
  assert.equal(deliveryFee(cartTotal(items), 'delivery'), 199);
  assert.deepEqual(drink, originalDrink);
  assert.equal(drink.price, 490);
});

test('покупной морс остаётся платной строкой рядом с единственным подарочным', () => {
  const drink = products.find(product => product.id === 'dr2');
  const cart = [{ ...breakfast, price: 1600, quantity: 1 }, { ...drink, quantity: 1 }];
  const items = getOrderItems(cart, 'delivery');
  assert.equal(items.filter(item => item.id === 'dr2').length, 2);
  assert.equal(items.filter(item => item.isGift).length, 1);
  assert.equal(items.find(item => item.id === 'dr2' && !item.isGift).price, 490);
  assert.equal(cartTotal(items), 2090);
});

test('пересчёт состава не дублирует подарок и удаляет его при смене на самовывоз', () => {
  const cart = [{ ...breakfast, price: 2200, quantity: 1 }];
  const savedItems = getOrderItems(cart, 'delivery');
  assert.equal(getOrderItems(savedItems, 'delivery').filter(item => item.isGift).length, 1);
  assert.deepEqual(getOrderItems(savedItems, 'pickup'), cart);
  assert.deepEqual(getOrderItems([{ ...cart[0], price: 1990 }, savedItems[1]], 'delivery'), [{ ...cart[0], price: 1990 }]);
});

test('записи российского номера с +7, 7, 8 и без префикса приводятся к одному номеру', () => {
  for (const phone of ['+7 (999) 123-45-67', '8 999 123 45 67', '79991234567', '9991234567', '(999) 123-45-67', '+7\u00a0999\u202f123‑45‑67']) {
    assert.equal(normalizePhone(phone), '+79991234567');
  }
});

test('поддерживаются городские и федеральные российские номера', () => {
  assert.equal(normalizePhone('8 (495) 123-45-67'), '+74951234567');
  assert.equal(normalizePhone('(812) 123-45-67'), '+78121234567');
  assert.equal(normalizePhone('8005553535'), '+78005553535');
});

test('отклоняются неполные номера, лишние цифры, неподдерживаемые страны и посторонние символы', () => {
  for (const phone of [null, undefined, '', '+7', '999123456', '799912345678', '+7 8 9991234567', '+9991234567',
    '+8 (999) 123-45-67', '+1 212 555 1234', '+7 701 123-45-67', '7011234567',
    '0000000000', '7+9991234567', '++79991234567', '+7 ((999)1234567', '+7 (999) abc1234567',
    '8 999 123 45 67 доб. 5', '79991234567/5']) {
    assert.equal(normalizePhone(phone), null, String(phone));
  }
});

test('отображение телефона не меняет его при сохранении и не скрывает неверный ввод', () => {
  assert.equal(formatPhone('89991234567'), '+7 (999) 123-45-67');
  assert.equal(normalizePhone(formatPhone('84951234567')), '+74951234567');
  assert.equal(formatPhone('+7 123'), '+7 123');
  assert.equal(formatPhone(null), '');
});

test('бронь интерпретирует выбранное время по Москве', () => {
  const now = new Date('2026-11-07T17:59:00Z');
  assert.equal(validReservation('2026-11-07', '21:00', now), true);
  assert.equal(validReservation('2026-11-07', '20:59', now), false);
  assert.equal(validReservation('2026-11-07', '20:58', now), false);
});

test('бронь должна быть строго в будущем, включая границу суток', () => {
  const now = new Date('2026-11-07T20:59:00Z');
  assert.equal(validReservation('2026-11-08', '00:00', now), true);
  assert.equal(validReservation('2026-11-07', '23:59', now), false);
  assert.equal(validReservation('2026-11-06', '21:00', now), false);
});

test('отсутствующие и неразбираемые дата или время не считаются будущей бронью', () => {
  const now = new Date('2026-11-07T12:00:00Z');
  assert.equal(validReservation('', '21:00', now), false);
  assert.equal(validReservation('2026-11-08', '', now), false);
  assert.equal(validReservation('invalid', '21:00', now), false);
  assert.equal(validReservation('2026-11-08', '25:00', now), false);
});
