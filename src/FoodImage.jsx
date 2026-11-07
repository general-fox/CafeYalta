import { backgroundSamples } from './photoTones';

const filterId = image => 'dish-tone-' + image.replace(/[^a-z0-9]/gi, '-');

// A display-only background key: match the neutral photographic backdrop,
// preserving colourful food, bright crockery and the original image files.
export function FoodPhotoFilters() {
  const gate = '0 0 0 0 1 1 1 1 1 1 1 1 1 0 0 0 0';
  return <svg width="0" height="0" className="photo-filter-definitions" aria-hidden="true"><defs>
    {Object.entries(backgroundSamples).map(([file, [r, g, b]]) => <filter key={file} id={filterId(file)} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
      <feColorMatrix in="SourceGraphic" type="matrix" values={`1 0 0 0 ${0.5-r/255} 0 1 0 0 ${0.5-g/255} 0 0 1 0 ${0.5-b/255} 0 0 0 1 0`} result="relative"/>
      <feComponentTransfer in="relative" result="gates"><feFuncR type="table" tableValues={gate}/><feFuncG type="table" tableValues={gate}/><feFuncB type="table" tableValues={gate}/></feComponentTransfer>
      <feColorMatrix in="gates" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0" result="red"/>
      <feColorMatrix in="gates" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0" result="green"/>
      <feColorMatrix in="gates" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0" result="blue"/>
      <feComposite in="red" in2="green" operator="in" result="redGreen"/>
      <feComposite in="redGreen" in2="blue" operator="in" result="backgroundMask"/>
      <feGaussianBlur in="backgroundMask" stdDeviation="0.5" result="softMask"/>
      <feFlood floodColor="#e8e5df" result="backdrop"/>
      <feComposite in="backdrop" in2="softMask" operator="in" result="matchedBackdrop"/>
      <feComposite in="matchedBackdrop" in2="SourceGraphic" operator="over"/>
    </filter>)}
  </defs></svg>;
}

export default function FoodImage({ product, className = '', alt, loading = 'lazy' }) {
  return <img className={`food-photo ${className}`} src={`${import.meta.env.BASE_URL}assets/${product.image}`} alt={alt ?? product.name} loading={loading} style={backgroundSamples[product.image] ? { filter: `url(#${filterId(product.image)})` } : undefined}/>;
}
