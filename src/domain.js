import { parsePhoneNumberFromString } from 'libphonenumber-js/core';
import fullMetadata from 'libphonenumber-js/metadata.max';
import { products } from './data.js';

// Keep both regions sharing +7 so Russian numbers can be distinguished from Kazakh numbers.
// Static property access lets the production build omit metadata for other calling codes.
export const phoneMetadata = {
  version: fullMetadata.version,
  country_calling_codes: { 7: fullMetadata.country_calling_codes['7'] },
  countries: { RU: fullMetadata.countries.RU, KZ: fullMetadata.countries.KZ },
};

export const money = value => new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
export function cartTotal(cart) { return cart.reduce((sum, item) => sum + item.price * item.quantity, 0); }
export const COURIER_FEE = 199;
export function deliveryFee(_subtotal, method) { return method === 'pickup' ? 0 : COURIER_FEE; }
export function getOrderGift(cart, method) {
  const subtotal = cartTotal(cart.filter(item => !item.isGift));
  if (method !== 'delivery' || subtotal < 2000) return null;
  const drink = products.find(product => product.id === 'dr2');
  return drink ? { ...drink, price: 0, quantity: 1, isGift: true } : null;
}
export function getOrderItems(cart, method) {
  const paidItems = cart.filter(item => !item.isGift).map(item => ({ ...item }));
  const gift = getOrderGift(paidItems, method);
  return gift ? [...paidItems, gift] : paidItems;
}
export function normalizePhone(value) {
  if (typeof value !== 'string') return null;
  const compact = value.trim().replace(/[\p{Zs}.\-\u2010-\u2014]/gu, '');
  if (!/^\+?(?:\d+|\d*\(\d+\)\d+)$/.test(compact)) return null;
  const number = /^(?:\+7|7|8)?(\d{10})$/.exec(compact.replace(/[()]/g, ''));
  if (!number) return null;

  // Russia and Kazakhstan share +7. Check the national range as well as the length.
  const phone = parsePhoneNumberFromString('+7' + number[1], phoneMetadata);
  return phone?.country === 'RU' && phone.isValid() ? phone.number : null;
}

export function formatPhone(value) {
  const phone = normalizePhone(value);
  if (!phone) return typeof value === 'string' ? value : '';
  return phone.replace(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/, '+7 ($1) $2-$3-$4');
}

export function changeQuantity(cart, product, delta) {
  const found = cart.find(item => item.id === product.id);
  if (!found) return delta > 0 ? [...cart, { ...product, quantity: Math.min(delta, 30) }] : cart;
  return cart.map(item => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + delta, 30) } : item).filter(item => item.quantity > 0);
}
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function validReservation(date, time, now = new Date()) { return new Date(`${date}T${time}:00+03:00`).getTime() > now.getTime(); }
