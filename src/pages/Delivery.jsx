import { useEffect, useRef, useState } from 'react';
import { ChevronUp, Search, X } from 'lucide-react';
import { categories, products } from '../data';
import { ProductCard } from '../components';
import { useShop } from '../store';
import DeliveryOffers from '../DeliveryOffers';

export default function Delivery() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('breakfast');
  const [introExpanded, setIntroExpanded] = useState(true);
  const { deliveryMethod: method, setDeliveryMethod: setMethod } = useShop();
  const mobileNav = useRef();
  const navigating = useRef(false);
  const timer = useRef();
  const filtered = products.filter(product => `${product.name} ${product.description}`.toLowerCase().includes(query.toLowerCase().trim()));
  const choose = id => {
    setActive(id);
    navigating.current = true;
    document.getElementById(`category-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { navigating.current = false; }, 950);
  };
  useEffect(() => {
    const nav = mobileNav.current;
    const button = nav?.querySelector(`[data-category="${active}"]`);
    if (button && nav.clientWidth) nav.scrollTo({ left: button.offsetLeft - nav.clientWidth / 2 + button.clientWidth / 2, behavior: 'smooth' });
  }, [active]);
  useEffect(() => {
    const header = document.querySelector('.site-header');
    const categoryBar = document.querySelector('.category-bar');
    const sections = [...document.querySelectorAll('.menu-section')];
    const previousMargins = sections.map(section => section.style.scrollMarginTop);
    let observer;
    let currentOffset;
    const updateObserver = () => {
      // A display:none category bar measures zero on desktop.
      const offset = (header?.getBoundingClientRect().height ?? 0)
        + (categoryBar?.getBoundingClientRect().height ?? 0) + 16;
      if (offset === currentOffset) return;
      currentOffset = offset;
      observer?.disconnect();
      observer = new IntersectionObserver(entries => {
        if (navigating.current) return;
        const visible = entries.filter(entry => entry.isIntersecting);
        if (visible.length) setActive(visible[0].target.dataset.category);
      }, { rootMargin: `-${offset}px 0px -55% 0px`, threshold: 0 });
      sections.forEach(section => {
        // Keep click navigation aligned with the category tracking boundary.
        section.style.scrollMarginTop = `${offset}px`;
        observer.observe(section);
      });
    };
    updateObserver();
    const resizeObserver = new ResizeObserver(updateObserver);
    if (header) resizeObserver.observe(header);
    if (categoryBar) resizeObserver.observe(categoryBar);
    return () => {
      observer?.disconnect();
      resizeObserver.disconnect();
      sections.forEach((section, index) => { section.style.scrollMarginTop = previousMargins[index]; });
      clearTimeout(timer.current);
      navigating.current = false;
    };
  }, [query]);
  const categoryButtons = categories.map(category => <button key={category.id} data-category={category.id} disabled={!filtered.some(product => product.category === category.id)} className={active === category.id ? 'active' : ''} onClick={() => choose(category.id)} aria-current={active === category.id ? 'true' : undefined}>{category.name}</button>);
  const search = <label className="search-box"><Search size={19}/><input aria-label="Поиск блюд" placeholder="Найти блюдо" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button onClick={() => setQuery('')} aria-label="Очистить поиск"><X size={18}/></button>}</label>;
  return <main className="delivery-page">
    <section className="delivery-intro" aria-label="О кафе и доставке">
      <div className="delivery-intro-handle">
        <button className="delivery-intro-toggle" aria-expanded={introExpanded} aria-controls="delivery-intro-content" aria-label={introExpanded ? 'Свернуть информацию о кафе' : 'Показать информацию о кафе'} title={introExpanded ? 'Свернуть' : 'О кафе и доставке'} onClick={() => setIntroExpanded(expanded => !expanded)}><ChevronUp size={20}/></button>
      </div>
      <div id="delivery-intro-content" className={`delivery-intro-collapse${introExpanded ? ' is-expanded' : ''}`} inert={!introExpanded} aria-hidden={!introExpanded}>
      <div className="delivery-intro-clip">
      <div className="container delivery-heading">
      <div className="delivery-information">
      <div className="restaurant-info">
        <h1>Кафе «Ялта»</h1>
        <address className="restaurant-details">
          <p>Москва, ул. Покровка, 27</p>
          <a href="tel:+74951234567">+7 (495) 123-45-67</a>
          <p>Ежедневно 09:00–23:00</p>
        </address>
      </div>
      <div className="delivery-service">
        <div className="segmented" role="group" aria-label="Способ получения заказа">
          <button className={method === 'delivery' ? 'active' : ''} aria-pressed={method === 'delivery'} onClick={() => setMethod('delivery')}>Доставка</button>
          <button className={method === 'pickup' ? 'active' : ''} aria-pressed={method === 'pickup'} onClick={() => setMethod('pickup')}>Самовывоз</button>
        </div>
        <div className="delivery-terms" aria-live="polite">
          {method === 'delivery' ? <>
            <p className="delivery-terms-primary">45–60 минут · заказ от 800 ₽</p>
            <p>250 ₽ · бесплатно от 2 500 ₽</p>
            <p>В пределах 5 км от кафе.</p>
          </> : <>
            <p className="delivery-terms-primary">Готовим за 25 минут</p>
            <p>Без минимальной суммы и платы за выдачу.</p>
            <p>Заберите заказ на Покровке, 27.</p>
          </>}
        </div>
      </div>
      </div>
      <DeliveryOffers onChoose={category => { setMethod('delivery'); setQuery(''); requestAnimationFrame(() => choose(category)); }}/>
      </div>
      </div>
      </div>
    </section>
    <div className="category-bar"><div className="container category-inner"><nav ref={mobileNav} className="category-nav" aria-label="Категории меню">{categoryButtons}</nav></div></div>
    <div className="container menu-layout">
      <aside className="category-sidebar">{search}<nav aria-label="Категории меню на компьютере">{categoryButtons}</nav></aside>
      <div className="menu-main"><div className="mobile-menu-search">{search}</div><p className="demo-menu-note">Демонстрационное меню</p>
        {filtered.length ? categories.map(category => {
          const list = filtered.filter(product => product.category === category.id);
          return list.length > 0 && <section key={category.id} id={`category-${category.id}`} data-category={category.id} className="menu-section"><div className="menu-section-title"><h2>{category.name}</h2></div><div className="menu-products">{list.map((product, index) => <ProductCard key={product.id} product={product} index={index}/>)}</div></section>;
        }) : <div className="empty-state"><Search size={35}/><h2>Такого блюда пока нет</h2><button className="button-outline" onClick={() => setQuery('')}>Показать всё меню</button></div>}
      </div>
    </div>
  </main>;
}
