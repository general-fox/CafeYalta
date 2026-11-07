import { products } from './data';

const catalogImages = Object.fromEntries(products.map(product => [product.id, product.image]));

export default function FoodImage({ product, className = '', alt, loading = 'lazy' }) {
  // Saved demo baskets may still carry old photo paths; show the current photo
  // without changing their quantities, prices or order history.
  const image = catalogImages[product.id] || product.image;
  return <img className={`food-photo ${className}`} src={`${import.meta.env.BASE_URL}assets/${image}`} alt={alt ?? product.name} loading={loading} decoding="async"/>;
}
