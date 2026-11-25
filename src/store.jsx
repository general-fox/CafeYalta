import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { changeQuantity } from './domain';
import { categories as demoCategories, products as demoProducts } from './data';
import { apiRequest, commitCheckoutTransition, configuredIikoProduct, isOrderPending, readCheckoutAttempt, reconcileIikoCart } from './iiko';
import { sameCatalogContent, startCatalogSync } from './catalog-sync';
const ShopContext = createContext(null);
const IIKO_MODE = import.meta.env.VITE_CATALOG_SOURCE === 'iiko';
const EMPTY = [];
function useSaved(key, initial) {
  const prefix = IIKO_MODE ? 'yalta-iiko-' : 'yalta-';
  const [value, setValue] = useState(() => { try { return JSON.parse(localStorage.getItem(prefix + key)) ?? initial; } catch { return initial; } });
  useEffect(() => { try { localStorage.setItem(prefix + key, JSON.stringify(value)); } catch { /* Private mode can disallow storage. */ } }, [prefix, key, value]);
  return [value, setValue];
}
export function ShopProvider({ children }) {
  const [storedCart, setStoredCart] = useSaved('cart', []);
  const [storedMethod, setStoredMethod] = useSaved('delivery-method', 'delivery');
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
  const [catalog, setCatalog] = useState(null);
  const [catalogStatus, setCatalogStatus] = useState(IIKO_MODE ? 'loading' : 'ready');
  const [catalogError, setCatalogError] = useState('');
  const [checkoutStorageError, setCheckoutStorageError] = useState('');
  const [checkoutAttempt, setStoredAttempt] = useState(() => {
    if (!IIKO_MODE) return null;
    try { return readCheckoutAttempt(sessionStorage); } catch { return { invalid: true }; }
  });
  const catalogRequest = useRef(0);
  const catalogReference = useRef(null);
  const catalogFetch = useRef(null);
  const catalogActive = useRef(false);
  const catalogLifecycle = useRef(0);
  const attemptReference = useRef(checkoutAttempt);
  const notify = useCallback(message => setToast(message), []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 3800); return () => clearTimeout(t); } }, [toast]);

  const refreshCatalog = useCallback(function refresh(force = true) {
    if (!IIKO_MODE || !catalogActive.current) return Promise.resolve(null);
    const pending = catalogFetch.current;
    if (pending) {
      if (force && !pending.force) {
        const lifecycle = catalogLifecycle.current;
        return pending.promise.then(() => lifecycle === catalogLifecycle.current ? refresh(true) : null);
      }
      return pending.promise;
    }
    const revision = ++catalogRequest.current;
    const request = { force, controller: new AbortController(), promise: null };
    catalogFetch.current = request;
    if (!catalogReference.current) {
      setCatalogStatus('loading');
      setCatalogError('');
    }
    request.promise = (async () => {
      try {
        const data = await apiRequest(force ? '/api/menu?refresh=1' : '/api/menu', { signal: request.controller.signal });
        if (data?.source !== 'iiko' || !Array.isArray(data.categories) || !Array.isArray(data.products)) throw new Error('Меню пока недоступно. Повторите загрузку.');
        if (revision === catalogRequest.current && catalogActive.current) {
          if (!sameCatalogContent(catalogReference.current, data)) {
            catalogReference.current = data;
            setCatalog(data);
          }
          setCatalogStatus('ready');
          setCatalogError('');
        }
        return data;
      } catch (error) {
        if (revision === catalogRequest.current && catalogActive.current && !request.controller.signal.aborted) {
          setCatalogStatus('error');
          setCatalogError(error.message || 'Меню пока недоступно. Повторите загрузку.');
        }
        return null;
      } finally {
        if (catalogFetch.current === request) catalogFetch.current = null;
      }
    })();
    return request.promise;
  }, []);

  useEffect(() => {
    if (!IIKO_MODE) return;
    catalogActive.current = true;
    const stop = startCatalogSync({ refresh: () => refreshCatalog(false), document, window });
    return () => {
      stop();
      catalogActive.current = false;
      catalogLifecycle.current += 1;
      catalogRequest.current += 1;
      const pending = catalogFetch.current;
      catalogFetch.current = null;
      pending?.controller.abort();
    };
  }, [refreshCatalog]);

  const orderLocked = IIKO_MODE && isOrderPending(checkoutAttempt);
  const products = IIKO_MODE ? catalog?.products || EMPTY : demoProducts;
  const categories = IIKO_MODE ? catalog?.categories || EMPTY : demoCategories;
  const orderingEnabled = !IIKO_MODE || (catalogStatus === 'ready' && catalog?.orderingEnabled === true);
  const cart = useMemo(() => IIKO_MODE && catalog && !orderLocked
    ? reconcileIikoCart(storedCart, products) : storedCart, [storedCart, products, catalog, orderLocked]);
  useEffect(() => {
    if (IIKO_MODE && catalog && !orderLocked) setStoredCart(previous => {
      const next = reconcileIikoCart(previous, catalog.products);
      return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
    });
  }, [catalog, orderLocked, setStoredCart]);

  const setCheckoutAttempt = useCallback((attempt, expectedRequestId, options) => {
    try {
      if (!commitCheckoutTransition(sessionStorage, attemptReference, attempt, expectedRequestId, options)) return false;
      setStoredAttempt(attempt);
      setCheckoutStorageError('');
      return true;
    } catch {
      setCheckoutStorageError('Не удалось сохранить состояние заказа в этом браузере. Разрешите хранение данных сайта и повторите.');
      throw new Error('Не удалось сохранить состояние заказа. Отправка остановлена.');
    }
  }, []);

  const setCart = update => {
    if (IIKO_MODE && isOrderPending(attemptReference.current)) { notify('Сначала проверьте состояние отправленного заказа'); return false; }
    if (IIKO_MODE && attemptReference.current) {
      try {
        if (!setCheckoutAttempt(null, attemptReference.current.requestId, { clearTerminal: true })) return false;
      } catch {
        notify('Не удалось подготовить новую корзину. Разрешите хранение данных сайта и повторите.');
        return false;
      }
    }
    setStoredCart(previous => {
      const next = typeof update === 'function' ? update(previous) : update;
      return IIKO_MODE ? reconcileIikoCart(next, products) : next;
    });
    return true;
  };
  const deliveryMethod = storedMethod === 'pickup' ? 'pickup' : 'delivery';
  const setDeliveryMethod = method => {
    if (orderLocked) { notify('Сначала проверьте состояние отправленного заказа'); return; }
    if (method === 'pickup' || method === 'delivery') setStoredMethod(method);
  };
  const orders = IIKO_MODE ? allOrders : user ? allOrders.filter(o => o.phone === user.phone) : [];
  const reservations = user ? allReservations.filter(o => o.phone === user.phone) : [];
  const add = (product, delta = 1) => {
    if (IIKO_MODE && (product.source !== 'iiko' || (delta > 0 && (!orderingEnabled || product.available === false)))) return;
    if (IIKO_MODE && delta > 0 && cart.filter(item => item.id === product.id).reduce((sum, item) => sum + item.quantity, 0) + delta > 30) {
      notify('Одного блюда можно заказать не больше 30 порций, включая все варианты состава.'); return false;
    }
    if (IIKO_MODE && delta > 0 && product.modifierGroups?.length && !Array.isArray(product.selections)) {
      if (orderLocked) { notify('Сначала проверьте состояние отправленного заказа'); return false; }
      setModal({ type: 'product', product });
      return false;
    }
    return setCart(previous => changeQuantity(previous, product, delta));
  };
  const addConfigured = (product, selections, quantity = 1, replacingLineId) => {
    if (!IIKO_MODE || !orderingEnabled || !Number.isInteger(quantity) || quantity < 1 || quantity > 30) return false;
    const current = products.find(item => item.id === product.id);
    if (!current?.available) { notify('Это блюдо сейчас недоступно'); return false; }
    if (replacingLineId && !cart.some(item => (item.lineId || item.id) === replacingLineId)) return false;
    try {
      const configured = configuredIikoProduct(current, selections);
      const existingQuantity = cart.filter(item => (item.lineId || item.id) !== replacingLineId && item.id === configured.id)
        .reduce((sum, item) => sum + item.quantity, 0);
      if (existingQuantity + quantity > 30) { notify('Одного блюда можно заказать не больше 30 порций, включая все варианты состава.'); return false; }
      return setCart(previous => changeQuantity(replacingLineId
        ? previous.filter(item => (item.lineId || item.id) !== replacingLineId) : previous, configured, quantity));
    } catch (error) { notify(error.message); return false; }
  };
  const saveOrder = useCallback(order => setAllOrders(previous => [order, ...previous.filter(item => item.id !== order.id)]), [setAllOrders]);
  const clearAcceptedCart = useCallback(() => setStoredCart([]), [setStoredCart]);
  return <ShopContext.Provider value={{
    isIiko: IIKO_MODE, cart, setCart, products, categories, catalogStatus, catalogError, refreshCatalog, orderingEnabled,
    ordering: catalog?.ordering || null, deliveryMethod, setDeliveryMethod,
    user, setUser, orders, reservations, add, addConfigured, modal, setModal, toast, notify, openAuth: () => setModal('auth'), saveOrder,
    saveReservation: item => setAllReservations(previous => [item, ...previous]),
    checkoutAttempt, setCheckoutAttempt, checkoutStorageError, orderLocked, clearAcceptedCart,
  }}>{children}</ShopContext.Provider>;
}
export const useShop = () => useContext(ShopContext);
