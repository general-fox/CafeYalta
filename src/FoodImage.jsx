import { products } from './data';

const assetRoot = `${import.meta.env.BASE_URL}assets/`;
const cardSizes = '(max-width: 700px) calc(100vw - 40px), (max-width: 1170px) calc(40vw - 52px), min(320px, 23vw)';
const detailSizes = '(max-width: 700px) calc(100vw - 24px), 620px';

// Use the current catalog photo even when a saved basket contains an older path.
const catalogPhotos = new Map(products.map(({ id, image }) => {
  const name = /^generated\/menu\/([\w-]+)\.jpg$/.exec(image)?.[1];
  if (!name) return [id, { src: assetRoot + image }];
  const base = `${assetRoot}generated/menu/responsive/${name}-`;
  return [id, {
    src: base + '420.webp',
    thumbnail: base + '160.webp',
    srcSet: [420, 720, 1080].map(width => `${base}${width}.webp ${width}w`).join(', '),
  }];
}));

export default function FoodImage({ product, className = '', alt, variant = 'thumbnail', priority = false }) {
  const photo = catalogPhotos.get(product.id);
  const thumbnail = variant === 'thumbnail';
  const eager = priority || variant === 'detail';
  const fallback = product.image || 'menu-placeholder.svg';
  const src = (thumbnail && photo?.thumbnail) || photo?.src
    || (/^https?:\/\//i.test(fallback) ? fallback : assetRoot + fallback);

  return <img className={`food-photo ${className}`} alt={alt ?? product.name}
    width={photo?.srcSet ? 1080 : undefined} height={photo?.srcSet ? 1080 : undefined}
    loading={eager ? 'eager' : 'lazy'} fetchPriority={priority ? 'high' : undefined} decoding="async"
    sizes={photo?.srcSet && !thumbnail ? (variant === 'detail' ? detailSizes : cardSizes) : undefined}
    srcSet={thumbnail ? undefined : photo?.srcSet} src={src}/>;
}
