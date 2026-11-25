import { products } from './data.js';

export { phoneMetadata, normalizePhone, formatPhone } from './phone.js';

const rubleFormatter = new Intl.NumberFormat('ru-RU');
export const money = value => rubleFormatter.format(value) + ' ₽';
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
export function changeQuantity(cart, product, delta) {
  const key = product.lineId || product.id;
  const found = cart.find(item => (item.lineId || item.id) === key);
  if (!found) return delta > 0 ? [...cart, { ...product, quantity: Math.min(delta, 30) }] : cart;
  return cart.map(item => (item.lineId || item.id) === key ? { ...item, quantity: Math.min(item.quantity + delta, 30) } : item).filter(item => item.quantity > 0);
}
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function validReservation(date, time, now = new Date()) { return new Date(`${date}T${time}:00+03:00`).getTime() > now.getTime(); }
