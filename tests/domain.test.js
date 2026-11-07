import test from 'node:test';
import assert from 'node:assert/strict';
import {
  money,
  cartTotal,
  changeQuantity,
  deliveryFee,
  normalizePhone,
  validReservation,
} from '../src/domain.js';

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

test('платная доставка становится бесплатной ровно от 2500 рублей', () => {
  assert.equal(deliveryFee(800, 'delivery'), 250);
  assert.equal(deliveryFee(2499, 'delivery'), 250);
  assert.equal(deliveryFee(2500, 'delivery'), 0);
  assert.equal(deliveryFee(3000, 'delivery'), 0);
});

test('самовывоз бесплатный независимо от суммы блюд', () => {
  for (const amount of [0, 490, 2499, 2500]) {
    assert.equal(deliveryFee(amount, 'pickup'), 0);
  }
});

test('российские телефоны с 7 и 8 приводятся к одному формату', () => {
  for (const phone of ['+7 (999) 123-45-67', '8 999 123 45 67', '79991234567']) {
    assert.equal(normalizePhone(phone), '+79991234567');
  }
});

test('незаполненные, короткие, длинные и неподдерживаемые телефоны отклоняются', () => {
  for (const phone of ['', '+7', '9991234567', '799912345678', '69991234567', 'телефон']) {
    assert.equal(normalizePhone(phone), null, phone || 'пустой телефон');
  }
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
