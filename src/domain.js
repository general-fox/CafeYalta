export const money = value => new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
export function cartTotal(cart) { return cart.reduce((sum, item) => sum + item.price * item.quantity, 0); }
export function deliveryFee(total, method) { return method === 'pickup' || total >= 2500 ? 0 : 250; }
export function normalizePhone(phone) { const digits = phone.replace(/\D/g, ''); return digits.length === 11 && /^[78]/.test(digits) ? '+7' + digits.slice(1) : null; }
export function changeQuantity(cart, product, delta) {
  const found = cart.find(item => item.id === product.id);
  if (!found) return delta > 0 ? [...cart, { ...product, quantity: Math.min(delta, 30) }] : cart;
  return cart.map(item => item.id === product.id ? { ...item, quantity: Math.min(item.quantity + delta, 30) } : item).filter(item => item.quantity > 0);
}
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function validReservation(date, time, now = new Date()) { return new Date(`${date}T${time}:00+03:00`).getTime() > now.getTime(); }
