import { useEffect, useRef } from 'react';
import { X, Plus, Minus, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useShop } from './store';
import { money } from './domain';
export const asset = name => `${import.meta.env.BASE_URL}assets/${name}`;
export function Waves({ className = '' }) { return <svg className={`waves ${className}`} viewBox="0 0 160 44" fill="none" aria-hidden="true"><path d="M0 5 Q10 -3 20 5T40 5T60 5T80 5T100 5T120 5T140 5T160 5M0 21 Q10 13 20 21T40 21T60 21T80 21T100 21T120 21T140 21T160 21M0 37 Q10 29 20 37T40 37T60 37T80 37T100 37T120 37T140 37T160 37" stroke="currentColor" strokeWidth="1.6"/></svg>; }
export function Gulls({ className = '' }) { return <svg className={`gulls ${className}`} viewBox="0 0 140 80" fill="none" aria-hidden="true"><path d="M15 40 Q38 22 54 43 Q61 20 88 21M84 64 Q98 55 108 67 Q115 51 131 53M38 13 Q50 4 60 17 Q66 3 80 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>; }
export function ArrowLink({ to, children }) { return <Link className="text-link" to={to}>{children}<ArrowUpRight size={19}/></Link>; }
export function Quantity({ product, quantity }) { const { add } = useShop(); return <div className="quantity"><button type="button" onClick={() => add(product, -1)} aria-label={`Убрать одну порцию: ${product.name}`}><Minus size={16}/></button><span aria-live="polite">{quantity}</span><button type="button" onClick={() => add(product)} disabled={quantity >= 30} aria-label={`Добавить одну порцию: ${product.name}`}><Plus size={16}/></button></div>; }
export function ProductCard({ product, index = 0 }) { const { cart, add, setModal } = useShop(); const quantity = cart.find(item => item.id === product.id)?.quantity || 0; return <article className="product-card reveal" style={{ '--delay': `${index % 3 * 70}ms` }}><button className="product-image" onClick={() => setModal({ type: 'product', product })} aria-label={`Подробнее: ${product.name}`}><img src={asset(product.image)} alt={product.name} loading="lazy"/>{product.tag && <span className="product-tag">{product.tag}</span>}<span className="image-open"><ArrowUpRight size={22}/></span></button><div className="product-copy"><span className="product-weight">{product.weight}</span><h3><button onClick={() => setModal({ type: 'product', product })}>{product.name}</button></h3><p>{product.description}</p><div className="product-bottom"><strong>{money(product.price)}</strong>{quantity ? <Quantity product={product} quantity={quantity}/> : <button className="add-button" onClick={() => add(product)} aria-label={`Добавить в корзину: ${product.name}`}><Plus size={18}/><span>Добавить</span></button>}</div></div></article>; }
export function Modal({ title, children, className = '', onClose }) {
  const ref = useRef(); const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement; const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    ref.current?.querySelector('input, button, select, textarea, a')?.focus();
    const handleKey = e => { if (e.key === 'Escape') closeRef.current(); if (e.key === 'Tab') { const all = [...ref.current.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')].filter(el => !el.disabled && el.offsetParent !== null); const first = all[0], last = all.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } } };
    document.addEventListener('keydown', handleKey); return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section ref={ref} className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close icon-button" onClick={onClose} aria-label="Закрыть окно"><X size={23}/></button><h2 id="modal-title">{title}</h2>{children}</section></div>;
}
