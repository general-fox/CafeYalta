import { useEffect, useRef, useState } from 'react';
import { Clock3, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useShop } from '../store';
import { COURIER_FEE } from '../domain';
import { ProductCard } from '../components';

function categoryScrollBehavior() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
}

export default function Delivery({ mobileCart }) {
  const { isIiko, categories, products, catalogStatus, catalogError, refreshCatalog, orderingEnabled, orderLocked } = useShop();
  const [query, setQuery] = useState('');
  const [selection, setSelection] = useState({ id: 'breakfast', center: false });
  const mobileNav = useRef(null);
  const destination = useRef(null);
  const sectionOffset = useRef(0);
  const active = selection.id;
  const filtered = products.filter(product => `${product.name} ${product.description}`.toLowerCase().includes(query.toLowerCase().trim()));

  function choose(id) {
    const section = document.getElementById(`category-${id}`);
    if (!section) return;
    const maxScroll = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const top = Math.max(0, Math.min(maxScroll, window.scrollY + section.getBoundingClientRect().top - sectionOffset.current));
    destination.current = top;
    setSelection({ id, center: true });
    window.scrollTo({ top, behavior: categoryScrollBehavior() });
  }

  useEffect(() => {
    const nav = mobileNav.current;
    if (!nav) return;
    const button = [...nav.querySelectorAll('[data-category]')].find(element => element.dataset.category === selection.id);
    if (!button || !nav.clientWidth) return;
    const left = button.offsetLeft;
    const right = left + button.offsetWidth;
    if (!selection.center && left >= nav.scrollLeft && right <= nav.scrollLeft + nav.clientWidth) return;
    nav.scrollTo({ left: left - (nav.clientWidth - button.offsetWidth) / 2, behavior: categoryScrollBehavior() });
  }, [selection, categories]);

  useEffect(() => {
    if (categories.length && !categories.some(category => category.id === selection.id)) setSelection({ id: categories[0].id, center: false });
  }, [categories, selection.id]);

  useEffect(() => {
    const header = document.querySelector('.site-header');
    const bar = mobileNav.current?.closest('.category-bar');
    if (!header || !bar) return;
    const sections = [...document.querySelectorAll('.menu-section')];
    destination.current = null;
    let frame = 0;

    function trackSection() {
      frame = 0;
      if (destination.current !== null) {
        // Ignore headings passed on the way to the tapped category.
        if (Math.abs(window.scrollY - destination.current) <= 1) destination.current = null;
        return;
      }
      const root = document.documentElement;
      const atBottom = Math.ceil(window.scrollY + root.clientHeight) >= root.scrollHeight;
      let current = sections[0];
      if (atBottom) current = sections.at(-1);
      else {
        for (const section of sections) {
          if (section.getBoundingClientRect().top > sectionOffset.current + 1) break;
          current = section;
        }
      }
      const id = current?.dataset.category ?? null;
      setSelection(previous => previous.id === id ? previous : { id, center: false });
    }

    function scheduleTracking() {
      if (!frame) frame = window.requestAnimationFrame(trackSection);
    }

    function measureOffset() {
      document.documentElement.style.setProperty('--delivery-dock-height', bar.offsetHeight + 'px');
      const offset = header.getBoundingClientRect().height + 16;
      if (offset !== sectionOffset.current) destination.current = null;
      sectionOffset.current = offset;
      scheduleTracking();
    }

    function resumeTracking() { destination.current = null; }
    function onScrollKey(event) {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) resumeTracking();
    }
    function onScrollbarPress(event) {
      if (event.target === document.documentElement) resumeTracking();
    }

    measureOffset();
    const resize = new ResizeObserver(measureOffset);
    resize.observe(header);
    resize.observe(bar);
    window.addEventListener('scroll', scheduleTracking, { passive: true });
    window.addEventListener('wheel', resumeTracking, { passive: true });
    window.addEventListener('touchmove', resumeTracking, { passive: true });
    window.addEventListener('keydown', onScrollKey);
    window.addEventListener('pointerdown', onScrollbarPress);
    return () => {
      resize.disconnect();
      document.documentElement.style.removeProperty('--delivery-dock-height');
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', scheduleTracking);
      window.removeEventListener('wheel', resumeTracking);
      window.removeEventListener('touchmove', resumeTracking);
      window.removeEventListener('keydown', onScrollKey);
      window.removeEventListener('pointerdown', onScrollbarPress);
    };
  }, [query, products, catalogStatus]);
  const categoryButtons = categories.map(category => <button key={category.id} data-category={category.id} disabled={!filtered.some(product => product.category === category.id)} className={active === category.id ? 'active' : ''} onClick={() => choose(category.id)} aria-current={active === category.id ? 'true' : undefined}>{category.name}</button>);
  const search = <label className="search-box"><Search size={19}/><input aria-label="Поиск блюд" placeholder="Найти блюдо" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button onClick={() => setQuery('')} aria-label="Очистить поиск"><X size={18}/></button>}</label>;
  return <main className="delivery-page">
    <section className="delivery-facts" aria-labelledby="delivery-facts-title">
      <div className="container">
        <h1 id="delivery-facts-title" data-reveal="rise"><Clock3 size={19} strokeWidth={1.6} aria-hidden="true"/>Часы работы и доставка</h1>
        <dl data-reveal-group>
          <div data-reveal="rise"><dt>Кафе</dt><dd>11:00–23:00</dd></div>
          <div data-reveal="rise"><dt>{isIiko ? 'Получение' : 'Доставка'}</dt><dd>{isIiko ? 'Доставка и самовывоз' : '11:00–22:30'}</dd></div>
          <div data-reveal="rise"><dt>{isIiko ? 'Оплата' : 'До двери'}</dt><dd>{isIiko ? 'Наличными при получении' : <>до 60 минут · {COURIER_FEE}&nbsp;₽</>}</dd></div>
          <div data-reveal="rise"><dt>{isIiko ? 'Тестовый режим' : <span className="offer-discount">Скидка 20 % на доставку</span>}</dt><dd>{isIiko ? 'Без акций и промокодов' : <>по коду <span className="offer-code">CAFEYALTA2026</span></>}</dd></div>
        </dl>
      </div>
    </section>
    <div className="category-bar">
      <div className="container category-inner">
        <nav ref={mobileNav} className="category-nav" aria-label="Категории меню">{categoryButtons}</nav>
      </div>
      {mobileCart}
    </div>
    <div className="container menu-layout">
      <aside className="category-sidebar">{search}<nav aria-label="Категории меню на компьютере" data-reveal="soft">{categoryButtons}</nav></aside>
      <div className="menu-main"><div className="mobile-menu-search">{search}</div>
        {isIiko && catalogStatus === 'loading' && <div className="catalog-state" role="status">Загружаем меню…</div>}
        {isIiko && catalogStatus === 'error' && <div className="catalog-state" role="alert"><p>{catalogError}</p><button className="button-outline" onClick={() => refreshCatalog()}>Загрузить меню снова</button></div>}
        {isIiko && catalogStatus === 'ready' && !orderingEnabled && <div className="demo-notice">Оформление заказов сейчас недоступно. <button className="text-link" onClick={() => refreshCatalog()}>Проверить ещё раз</button></div>}
        {orderLocked && <div className="demo-notice">Проверяем отправленный заказ. <Link to="/checkout">Проверить состояние</Link></div>}
        {(catalogStatus === 'ready' || products.length > 0) && (filtered.length ? categories.map(category => {
          const list = filtered.filter(product => product.category === category.id);
          return list.length > 0 && <section key={category.id} id={`category-${category.id}`} data-category={category.id} className="menu-section"><div className="menu-section-title" data-reveal="rise"><h2>{category.name}</h2></div><div className="menu-products">{list.map(product => <ProductCard key={product.id} product={product} priority={product === products[0]}/>)}</div></section>;
        }) : <div className="empty-state"><Search size={35}/><h2>{query ? 'Такого блюда пока нет' : 'Меню пока пустое'}</h2>{query && <button className="button-outline" onClick={() => setQuery('')}>Показать всё меню</button>}</div>)}
      </div>
    </div>
  </main>;
}
