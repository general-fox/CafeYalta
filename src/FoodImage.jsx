import { backgroundSamples } from './photoTones';

const filterId = image => 'dish-tone-' + image.replace(/[^a-z0-9]/gi, '-');
const target = [199, 197, 191];

// Match exposure and white balance at the photographed background. Gamma
// correction preserves black, white, plate contours and all original detail.
export function FoodPhotoFilters() {
  return <svg width="0" height="0" className="photo-filter-definitions" aria-hidden="true"><defs>
    {Object.entries(backgroundSamples).map(([file, sample]) => {
      const gamma = sample.map((channel, index) => Math.log(target[index] / 255) / Math.log(channel / 255));
      return <filter key={file} id={filterId(file)} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
        <feComponentTransfer><feFuncR type="gamma" amplitude="1" exponent={gamma[0]}/><feFuncG type="gamma" amplitude="1" exponent={gamma[1]}/><feFuncB type="gamma" amplitude="1" exponent={gamma[2]}/></feComponentTransfer>
      </filter>;
    })}
  </defs></svg>;
}

export default function FoodImage({ product, className = '', alt, loading = 'lazy' }) {
  return <img className={`food-photo ${className}`} src={`${import.meta.env.BASE_URL}assets/${product.image}`} alt={alt ?? product.name} loading={loading} style={backgroundSamples[product.image] ? { filter: `url(#${filterId(product.image)})` } : undefined}/>;
}
