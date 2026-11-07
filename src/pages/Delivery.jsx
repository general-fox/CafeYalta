import { useEffect, useRef, useState } from 'react';
import { Search, X, Clock3, MapPin } from 'lucide-react';
import { categories, products } from '../data';
import { ProductCard } from '../components';
import { useShop } from '../store';

export default function Delivery() {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState('breakfast');
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
    const observer = new IntersectionObserver(entries => {
      if (navigating.current) return;
      const visible = entries.filter(entry => entry.isIntersecting);
      if (visible.length) setActive(visible[0].target.dataset.category);
    }, { rootMargin: '-150px 0px -55% 0px', threshold: 0 });
    document.querySelectorAll('.menu-section').forEach(element => observer.observe(element));
    return () => { observer.disconnect(); clearTimeout(timer.current); };
  }, [query]);
  const categoryButtons = categories.map(category => <button key={category.id} data-category={category.id} disabled={!filtered.some(product => product.category === category.id)} className={active === category.id ? 'active' : ''} onClick={() => choose(category.id)} aria-current={active === category.id ? 'true' : undefined}>{category.name}</button>);
  const search = <label className="search-box"><Search size={19}/><input aria-label="Поиск блюд" placeholder="Найти блюдо" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button onClick={() => setQuery('')} aria-label="Очистить поиск"><X size={18}/></button>}</label>;
  return <main className="delivery-page">
    <section className="container delivery-heading">
      <div><span className="eyebrow">ДОСТАВКА И САМОВЫВОЗ</span><h1>Меню «Ялты»</h1></div>
      <div className="delivery-service"><div className="segmented"><button className={method === 'delivery' ? 'active' : ''} onClick={() => setMethod('delivery')}>Доставка</button><button className={method === 'pickup' ? 'active' : ''} onClick={() => setMethod('pickup')}>Самовывоз</button></div><span>{method === 'delivery' ? <><Clock3 size={17}/> 45–60 минут · от 250 ₽</> : <><MapPin size={17}/> Покровка, 27 · 25 минут</>}</span></div>
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
