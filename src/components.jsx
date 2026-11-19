import { useEffect, useRef } from 'react';
import { X, Plus, Minus, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useShop } from './store';
import { money } from './domain';
import FoodImage from './FoodImage';
import './gull-wings.css';
export const asset = name => `${import.meta.env.BASE_URL}assets/${name}`;
export function Waves({ className = '' }) { return <svg className={`waves ${className}`} viewBox="0 0 160 44" fill="none" aria-hidden="true"><path d="M0 5 Q10 -3 20 5T40 5T60 5T80 5T100 5T120 5T140 5T160 5M0 21 Q10 13 20 21T40 21T60 21T80 21T100 21T120 21T140 21T160 21M0 37 Q10 29 20 37T40 37T60 37T80 37T100 37T120 37T140 37T160 37" stroke="currentColor" strokeWidth="1.6"/></svg>; }
export function Gulls({ className = '' }) {
  return <svg className={`gulls ${className}`} viewBox="0 0 300 164" fill="currentColor" aria-hidden="true" focusable="false">
    <g transform="translate(88 121)">
      <path className="gull-wing-left" d="M-78 12c12-7 27-20 42-25C-24-17-13-13 1-2l1 4-5 2C-16-7-24-12-37-9-52-5-64 6-78 12Z"/>
      <path className="gull-wing-right" d="M-2 1C3-8 7-20 15-32c12-17 26-20 45-27-8 7-18 10-27 15C21-36 13-20 6-5L2 2Z"/>
      <path d="M-7 0C-4 0-2-1 0-3l5-2c2-1 3-3 5-3l3 1 4 .2-5 2-4 4C3 4-1 6-7 2Z"/>
    </g>
    <g transform="translate(208 59)" opacity=".86">
      <path className="gull-wing-left" d="M-46 3c9-6 19-14 30-14 6 0 12 4 18 9L2 2l-4 1C-10-5-15-10-23-7c-8 1-15 7-23 10Z"/>
      <path className="gull-wing-right" d="M-1 0c6-11 13-18 22-21 9-3 16-2 23-2-8 3-15 3-22 7C14-12 9-5 5 1L1 3Z"/>
      <path d="M-4 0c3 0 4-2 7-2l3-1 3 1-3 2-3 3c-2 2-5 1-7-1Z"/>
    </g>
    <g transform="translate(265 127)" opacity=".72">
      <path className="gull-wing-left" d="M-32-7c8-4 17-6 24-3 4 2 6 5 9 9L1 2l-3 1C-6-6-14-13-32-7Z"/>
      <path className="gull-wing-right" d="M-1 1c6-9 12-14 18-15 5-1 9 0 13 1-7 0-12 2-16 5C9-5 6 1 2 3Z"/>
      <path d="M-3 0c2 1 3-1 5-2l3-.4 2 .6-3 2c-2 3-4 4-6 2Z"/>
    </g>
  </svg>;
}
export function ArrowLink({ to, children }) { return <Link className="text-link" to={to}>{children}<ArrowUpRight size={19}/></Link>; }
export function Quantity({ product, quantity }) { const { add } = useShop(); return <div className="quantity"><button type="button" onClick={() => add(product, -1)} aria-label={`Убрать одну порцию: ${product.name}`}><Minus size={16}/></button><span aria-live="polite">{quantity}</span><button type="button" onClick={() => add(product)} disabled={quantity >= 30} aria-label={`Добавить одну порцию: ${product.name}`}><Plus size={16}/></button></div>; }
export function ProductCard({ product, index = 0 }) { const { cart, add, setModal } = useShop(); const quantity = cart.find(item => item.id === product.id)?.quantity || 0; return <article className="product-card reveal" style={{ '--delay': `${index % 3 * 70}ms` }}><button className="product-image" onClick={() => setModal({ type: 'product', product })} aria-label={`Подробнее: ${product.name}`}><FoodImage product={product}/>{product.tag && <span className="product-tag">{product.tag}</span>}<span className="image-open"><ArrowUpRight size={22}/></span></button><div className="product-copy"><h3><button onClick={() => setModal({ type: 'product', product })}>{product.name}</button></h3><div className="product-bottom"><strong>{money(product.price)}</strong><div className="product-card-control">{quantity ? <Quantity product={product} quantity={quantity}/> : <button className="add-button" onClick={() => add(product)} aria-label={`Добавить в корзину: ${product.name}`}><Plus size={18}/><span>Добавить</span></button>}</div></div></div></article>; }
export function Modal({ title, children, className = '', onClose }) {
  const ref = useRef(); const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement; const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    ref.current?.querySelector('input, button, select, textarea, a')?.focus();
    const handleKey = e => { if (e.key === 'Escape') closeRef.current(); if (e.key === 'Tab') { const all = [...ref.current.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')].filter(el => !el.disabled && el.offsetParent !== null); const first = all[0], last = all.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } } };
    document.addEventListener('keydown', handleKey); return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKey);
      if (!previous?.disabled && previous?.getClientRects().length) previous.focus();
      else document.getElementById('main-content')?.focus({ preventScroll: true }); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section ref={ref} className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close icon-button" onClick={onClose} aria-label="Закрыть окно"><X size={23}/></button><h2 id="modal-title">{title}</h2>{children}</section></div>;
}
