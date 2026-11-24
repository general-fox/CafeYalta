const sceneWidths = [420, 720, 1080];

export function sceneImageProps(stem, sizes, baseUrl = import.meta.env.BASE_URL) {
  const base = `${baseUrl}assets/generated/scene/responsive/${stem}`;
  return {
    src: `${base}-720.webp`,
    srcSet: sceneWidths.map(width => `${base}-${width}.webp ${width}w`).join(', '),
    sizes,
  };
}

export const heroPhotoSizes = [
  '(min-width: 520px) and (max-width: 700px) and (max-height: 520px) and (orientation: landscape) calc(37.5vw - 27px)',
  '(max-width: 370px) calc(100vw - 40px)',
  '(max-width: 700px) calc(100vw - 48px)',
  '(max-width: 1240px) and (orientation: portrait) calc(46vw - 30px)',
  '(max-width: 900px) calc(40vw - 32px)',
  '(max-width: 1360px) calc(37.6vw - 32px)',
  '478px',
].join(', ');

export const interiorPhotos = [
  { stem: 'interior-main', width: 1448, height: 1086 },
  { stem: 'interior-detail', width: 1086, height: 1448 },
  { stem: 'interior-table', width: 1086, height: 1448 },
];

export const aboutInteriors = [
  {
    stem: 'hero-interior-main-v2',
    title: 'Светлый зал',
    alt: 'Светлый зал с большими окнами, синими диванами и деревянными столами',
    width: 1120,
    height: 1400,
    position: '50% 47%',
  },
  {
    stem: 'hero-interior-detail-v2',
    title: 'Уютный уголок',
    alt: 'Уголок кафе с синей банкеткой и столиком у окна',
    width: 1000,
    height: 1000,
    position: '50% 50%',
  },
  {
    stem: 'hero-interior-third-v2',
    title: 'Детали будущего кафе',
    alt: 'Кофейная стойка с синей плиткой',
    width: 960,
    height: 1200,
    position: '50% 50%',
  },
];
