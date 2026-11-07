import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { changeQuantity } from './domain';
const ShopContext = createContext(null);
function useSaved(key, initial) {
  const [value, setValue] = useState(() => { try { const value = JSON.parse(localStorage.getItem('yalta-' + key)); return value ?? initial; } catch { return initial; } });
  useEffect(() => { try { localStorage.setItem('yalta-' + key, JSON.stringify(value)); } catch { /* Private mode can disallow storage. */ } }, [key, value]);
  return [value, setValue];
}
export function ShopProvider({ children }) {
  const [cart, setCart] = useSaved('cart', []);
  const [deliveryMethod, setDeliveryMethod] = useSaved('delivery-method', 'delivery');
  const [user, setCurrentUser] = useSaved('user', null);
  const [profiles, setProfiles] = useSaved('profiles', {});
  const setUser = next => {
    if (!next) { setCurrentUser(null); return; }
    const profile = { ...(profiles[next.phone] || {}), ...next };
    setProfiles(previous => ({ ...previous, [next.phone]: profile }));
    setCurrentUser(profile);
  };
  const [allOrders, setAllOrders] = useSaved('orders', []);
  const [allReservations, setAllReservations] = useSaved('reservations', []);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const notify = useCallback(message => setToast(message), []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 3800); return () => clearTimeout(t); } }, [toast]);
  const orders = user ? allOrders.filter(o => o.phone === user.phone) : [];
  const reservations = user ? allReservations.filter(o => o.phone === user.phone) : [];
  const add = (product, delta = 1) => setCart(previous => changeQuantity(previous, product, delta));
  return <ShopContext.Provider value={{ cart, setCart, deliveryMethod, setDeliveryMethod, user, setUser, orders, reservations, add, modal, setModal, toast, notify, openAuth: () => setModal('auth'), saveOrder: order => setAllOrders(previous => [order, ...previous]), saveReservation: item => setAllReservations(previous => [item, ...previous]) }}>{children}</ShopContext.Provider>;
}
export const useShop = () => useContext(ShopContext);
