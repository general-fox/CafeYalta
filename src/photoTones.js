// Read-only sampling of the source photos: mean RGB over 18 points in
// the top left/right background (x=.02,.05,.10,.90,.95,.98; y=.02,.05,.10).
// Original bitmap files remain unchanged. These samples are approximate:
// lighting gradients and plate shadows are still part of each photo.
export const photoBackgrounds = {
  'food/beef-cheeks.jpg': [148, 153, 151],
  'food/borscht.jpg': [175, 183, 186],
  'food/burrata.jpg': [168, 177, 177],
  'food/caesar.jpg': [125, 132, 138],
  'food/chicken-cutlets.webp': [107, 113, 118],
  'food/chicken-soup.jpg': [193, 199, 202],
  'food/cranberry-drink.jpg': [103, 109, 112],
  'food/dorado.jpg': [156, 166, 172],
  'food/honey-cake.jpg': [176, 189, 194],
  'food/khachapuri.jpg': [172, 180, 182],
  'food/khinkali.jpg': [122, 129, 127],
  'food/lemonade.jpg': [145, 155, 157],
  'food/matsoni.jpg': [165, 178, 179],
  'food/napoleon.jpg': [148, 162, 165],
  'food/orange-juice.jpg': [161, 170, 175],
  'food/pumpkin-soup.jpg': [112, 120, 128],
  'food/seafood-salad.jpg': [166, 169, 169],
  'food/shrimp.jpg': [182, 190, 192],
  'food/syrniki.jpg': [142, 146, 150],
  'food/vegetable-salad.jpg': [180, 188, 190],
};

// Warm neutral gray, close to the median source background luminance.
export const photoToneTarget = [170, 169, 166]; // #aaa9a6

export const backgroundSamples = photoBackgrounds;

// Gentle fallback if an SVG channel adjustment is not used. Brightness is
// deliberately bounded to retain detail and avoid washing out the food.
export const photoTones = Object.fromEntries(
  Object.entries(photoBackgrounds).map(([file, [r, g, b]]) => {
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const brightness = Math.min(1.22, Math.max(0.88, 169 / luminance));
    return [file, `brightness(${brightness.toFixed(3)}) saturate(0.96)`];
  }),
);
