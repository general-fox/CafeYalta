import { useId } from 'react';

export default function HarborVillage() {
  const hatchId = useId();
  const shade = `url(#${hatchId})`;
  const paper = 'var(--harbor-paper)';
  const ink = 'var(--harbor-ink)';
  const mid = 'var(--harbor-mid)';
  const fine = 'var(--harbor-fine)';

  return <g className="harbor-village" stroke={ink} strokeWidth=".95" strokeLinecap="round" strokeLinejoin="round" fill="none">
    <defs>
      <pattern id={hatchId} width="4.2" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(8)">
        <rect width="4.2" height="9" fill={paper} stroke="none"/>
        <path d="M.7-1 .5 4l.08 6m2.2-11-.2 5.2.08 5.8" stroke={fine} strokeWidth=".55"/>
      </pattern>
    </defs>

    {/* Narrow hilltop lane and a row of windswept cypresses. */}
    <g stroke={mid} strokeWidth=".75">
      <path d="M365 64c10-2 18-7 24-12l10-2m28-14 11-9 13-2 9-7m-31 22 12-9 11-2 7-4"/>
      <path fill={shade} d="M438 35c-3-5 1-10 2-13 1-3 .8-5 2-6 1 7 4 13 1 18l-2 2-1 4m7-14c-2-4 .6-7 2-10l2-6c.5 5 2.5 10 .8 14l-3 3-1 3"/>
    </g>

    {/* Short stone retaining walls connect the lanes across the slope. */}
    <g stroke={mid} strokeWidth=".82">
      <path fill={paper} d="m355 75 32-11 36-1 20-11 12-2 .3 4.7-11 3.1-20 11.1-36 1.7-32.6 10.5Z"/>
      <path fill={paper} d="m292 109 37-6.7 16-8.9 26.8-.1 20.2-7.5 13.5-2.1.2 4.7-12.7 2.8-20.4 8.7-27.7-.5-12.5 8.5-36.7 6.7Z"/>
      <path stroke={fine} strokeWidth=".65" d="m363 72 1 3.5 4.1-.4m4-6.1.4 4.5 5.7-1.2m9-7.8.2 2.6 8.1-1m3.6-.4.2 3.4m9.2-4.6-3.3 2.5m21.3-4.5.1 3.4m5.8-6.2.3 3.7m7.2-8.5.4 3.1M296 109l1.6 2.5 4.1-.8m6-3.8.5 2.8m8.2-5.6.9 3 5.8-.7m6.4-5.2 1.2 2.4m18.3-9.8.4 2.5m6.8-3 .7 3.6m7.9-3.3-2.7 2.7m13.6-3.7-.2 2.3"/>
    </g>

    {/* An upper court steps forward from the hilltop house. */}
    <path fill={paper} d="m375 52 10-2.6 14 .3 4.8 4 .3 18.3-7.3 3.5-21.8-.5Z"/>
    <path fill={shade} d="m396 55 8-1.3.1 18.3-7.3 3.5Z"/>
    <path d="m372.8 54.1 9.8-7.2 14-.7 9.1 7.4-9.1 3.2Zm7.5-2.7 4-2.8m-1.2 4 4.5-3.7m.8 4 4.5-4" fill={paper} strokeWidth=".82"/>
    <path d="m380.4 60.5 4.6-.2.2 7.1-4.8.2Zm8.8 7.2 3.8-.2v7l-3.7.3Z" fill={mid} stroke="none"/>

    {/* A two-storey house at the crest with a parapet and a shaded return wall. */}
    <path fill={paper} d="m388 32 30-1 13-4 1 34-13 6-30-2Z"/>
    <path fill={shade} d="m418 31 13-4 1 34-13 6Z"/>
    <path fill={paper} d="m386 31 31-2 15-4 .3 3-14 5-32 1Zm4-2v-5l3-1 1 6m25-1 .2-5 8-2 .1 5"/>
    <path d="m394 41 4 .1 .2 6-4 .1Zm11-1 5-.2v7h-4.9Zm-10 14 3.8-.1v6h-3.9Zm11-.4 4.7-.1v11h-4.5Z" fill={shade} strokeWidth=".8"/>
    <path stroke={fine} strokeWidth=".6" d="m391 50 23-.5m-18.8-6v2m11.4-3.5v3m-1.7 16.8 4-.1m13-25 4-1m-3 6 4-1m-34 19.8h3"/>

    <path fill={paper} d="m407 63 12.5-1 12.8-6.5 8.2 1.3-.2 12.4-13.2 8.2-20 .4Z"/>
    <path fill={shade} d="m427 65 13.5-8.2-.1 12.4-13.3 8.2Z"/>
    <path d="m404.7 62.6 15.9-7.5 23.5.1-16.7 10.3-22.7.8m4.3 3.5 2.3-.2m2.7.1 3-.2m-8.3 2.7 5.7-.2" stroke={mid} strokeWidth=".85"/>
    <path fill={paper} d="m366 81 14-5.1 18.4-.3 5.6 2.8.2 13.5-10.2 5.4-28.1.1Z"/>
    <path fill={shade} d="m393.8 83.9 10.3-5.5.1 13.5-10.2 5.4Z"/>
    <path d="m364.6 80.7 13.2-6.4 27.2 1.1.8 2.6-11.7 6.1-29.3.4Zm4.5 6.7 4.5-.1v7.4h-4.5" fill={paper} strokeWidth=".8"/>
    <path d="m380 88.1 5.7-.1v5.7l-5.6.2Z" fill={fine} stroke="none"/>

    {/* Staggered roofs and a little loggia on the middle terraces. */}
    <path fill={paper} d="m342 61 28-.6 14-6.2.7 31.8-14 6.6-29-.6Z"/>
    <path fill={shade} d="m370 60.4 14-6.2.7 31.8-14 6.6Z"/>
    <path fill={paper} d="m338 60 13-7.4 21-.6 15 .8-17 9-32 .7Z"/>
    <path stroke={fine} strokeWidth=".6" d="m345 58 10-3.4 23-1m-29 5 11-3.4m9 3 4.4-2.1m4 13 4.7-2.2m-3.5 12 3.8-1.9"/>
    <path d="M347 71q2.6-6.4 5.4-.5v8l-5.4.2Zm9.6-.4q2.6-6.7 5.4-.3v8l-5.4.3Z" fill={shade} strokeWidth=".8"/>
    <path d="m340 81 25-.2 8.4-3v2.4l-8.1 3.2-25 .3m3.7 1.1.4 5.4m16.6-5.4.3 5.5" stroke={mid}/>
    <path fill={paper} d="m306 78 20-.5 8-3.4 .4 23.9-8.6 3.1-19.5-.3Z"/>
    <path fill={shade} d="m326 77.5 8-3.4 .4 23.9-8.6 3.1Z"/>
    <path d="m304.7 77.2 20.5-.7 10-3.4m-25.5 9.5 4-.1.1 6.6-4 .1Zm8.8-.4 4-.2.2 6.4-4 .3Z" strokeWidth=".82"/>

    <path fill={paper} d="m268 96 32-.7 14.3-4 .4 28.3-13.6 5.3-33 .5Z"/>
    <path fill={shade} d="m300 95.3 14.3-4 .4 28.3-13.6 5.3Z"/>
    <path fill={paper} d="m265.9 95.6 12.3-5.5 34.4-.7 2.7 1.7-15.1 5.9-34 .8Zm4.1-3.6.1-5.1 4.7-1.8v5.6"/>
    <path d="m274 104 5.4.1.1 8.6-5.5.2Zm13.3-.8 5.8-.1.1 8.7-5.6.2Z" strokeWidth=".85" fill={shade}/>
    <path stroke={mid} strokeWidth=".65" d="m271.7 104.5-2.2.5v6.6l2-.5m9.2-7.1 2.6.6v6.5l-2.4-.5m4.5-7-1.4.3m9.5.1 2.1.3v7l-2.1-.4m-22.6 3.7 12-.2m3.4-.4 10.1-.5"/>

    {/* Closely spaced annexes descend from the loggia into the middle lane. */}
    <path fill={paper} d="m335 92.7 20.8-.3 8.2-2.5.5 20.4-8.4 5.1-20.9.2Z"/>
    <path fill={shade} d="m355.8 92.4 8.2-2.5.5 20.4-8.4 5.1Z"/>
    <path d="m332.1 92.2 10.2-4.3 23.2.2-9.3 6.3-23.7.2Zm6.6 9.3 4.8-.1v6.1l-4.8.2Zm8.5 12.3v-8.3q2.1-4.5 4.7-.6l.1 8.5" fill={paper} strokeWidth=".76"/>
    <path stroke={mid} strokeWidth=".7" d="m337.2 96.6 16.1.2m-16.7 13.7 8.8-.2m8.7 7.9 9.3-5.5 5.4-.6m-13.3 7.3 6.3-3.3m4.1-1.2 9.5-.9 7.4-4.4 12.5-.1"/>
    <path fill={paper} d="m295 120.1 14.6-.2 8-4.9 12 .3.8 17.4-10.7 5.2-25 .3Z"/>
    <path fill={shade} d="m319.2 122.2 10.4-6.9.8 17.4-10.7 5.2Z"/>
    <path d="m293.7 120.3 11.6-6 25.8-.9v2.9l-11.4 7.3-26 .1Zm6.3 6.6 4.4-.3.2 6-4.4.4Zm9-.4 5.9-.1v9.6l-5.8.3Z" fill={paper} strokeWidth=".82"/>
    <path fill={mid} d="m310.7 127.1 2.8-.2.2 7.5-2.9.1Z" stroke="none"/>

    {/* The waterfront lane, with a short worn stair and an arched doorway. */}
    <path d="m179 142 15-1.5 22.5.8 8.3-2.4 20-.4 10.8-3.9 19-1.1m-88.2 10.3 21.2.7 18.5-3.2 16-.4" stroke={mid}/>
    <path fill={paper} d="m197 126 20-.4 7.1-3.2.3 15.5-7.7 3.6-19.5-.8Z"/>
    <path fill={shade} d="m217 125.6 7.1-3.2.3 15.5-7.7 3.6Z"/>
    <path d="m195.7 126.2 7-3 21.7-1m-23.8 8.8 4-.3v4.8l-3.9.3Zm8.2.4q2.3-3.8 4.1 0l.2 8.4m-15.3-2.2 5.3-.2" strokeWidth=".74"/>
    <path fill={paper} d="m229 113 23-.8 9.8-4.3.5 23.7-9 3.6-24 .5Z"/>
    <path fill={shade} d="m252 112.2 9.8-4.3.5 23.7-9 3.6Z"/>
    <path fill={paper} d="m226.8 112.2 11.3-5.9 25-.2.8 2-11.2 5.9-26.1.1Z"/>
    <path d="m233 119.2 4.2-.3.1 6-4 .2Zm9.5 14v-10.5q2.4-6 5.7-1.2v11.5" strokeWidth=".85"/>
    <path fill={paper} d="m217.6 129.5 6-2.3 11.9-.3 3.2 1.8.2 10.3-3.6 2.6-17.1-.1Z"/>
    <path d="m216.7 129.8 7.3-4 12 .1 3.5 2.7-4.1 2.5-18.6.6m4.6 6.4 10.1-.1m-7.9-5-.1 2.4m5.4-2.6v2.8" strokeWidth=".75"/>
    <path d="m275 125-9.2 3v1.7l-5.6 1.6v1.7l-5.9 1.6v2.1l-5.4 1.2m9.6-.7 14.8-4.3m-12.2.6 8.6-2.4" stroke={mid} strokeWidth=".74"/>

    <path fill={mid} stroke="none" d="m395.3 41.6 1.8-.1.1 4.4-1.8.3zm11-1.4 2.8-.1.1 5.9h-2.7Zm-57.9 32q1.2-2.2 2.2-.8l.2 5.8-2.3.2Zm-73.4 32.6 3.6-.1.1 7-3.5.2Zm13.7-.8 3.3-.2v7.1l-3.3.3Z"/>
    {/* Scrub olive beside the upper path. Broken loops pick up the branch engraving. */}
    <g stroke={mid} strokeWidth=".8">
      <path d="M326 132q5-9 3-18m-1.4 13 4.8-5.6 1.7-8.8m-5.6 7.4-4.3-4.9-6.8-2.7m11.4 3.2 2-6.8m1 9.6 5-4.8 4.5-2.3"/>
      <path d="M316.2 115.6q-5.8-1.1-4.3-4 1-1.5 4.3-1.1m-2.9-2.3q2-4 7.6-2.1m-1.3-1.6q2.8-4.6 7-.6 3-5.7 8-.8m.6 2q6-3.2 8.2 1m.4 2.3q4.6-.9 5.5 3.4m-1.5 1.5q-2 4.2-7 2.4m-5 1.5q-3.2 3.8-6 .9m-5.3-.6q-3 1-5.9-.9" fill={paper}/>
      <path strokeWidth=".55" d="m315 110 4-1.8m2.4 3 3.8-2.3m1.2-3.5 2.2-.9m2.6 6 3.6-3.2m1.1 4.3 5.2-2.4m-.6 4.7 3.5-1.5"/>
    </g>

    {/* A stepped terrace leads to the boathouse projecting above the cove. */}
    <path stroke={mid} d="m328 143 13-5 17-1.2 12-4.9 21-.5 13-5m-65.6 15 20.8-1.4 10.7-4.7 10-.5"/>
    <path fill={paper} d="m356 144 27-1.2 11-3.3.6 23-11.3 5-27.7.6Z"/>
    <path fill={shade} d="m383 142.8 11-3.3.6 23-11.3 5Z"/>
    <path d="m354 143.3 29-1.2 13.5-4.6m-34.8 13.6 4.3.1.2 7.1h-4.5zm9.1-.7 7 .1-.2 7.2-6.8.1Z" strokeWidth=".83"/>
    <path fill={paper} d="m335 166 44-1.6 20.6-7.6.8 32.3-20.4 9.4-44.7.3Z"/>
    <path fill={shade} d="m379 164.4 20.6-7.6.8 32.3-20.4 9.4Z"/>
    <path fill={paper} d="m332.8 164.9 17-7.9 47.4-1.6 5.6 1.6-23.2 9.8-46 .7Zm3.3-2.5-.1-3.9 3.3-1.8.4 4.3"/>
    <path d="M341 188v-15l7-.5.1 14.9Zm13.2 9.5-.2-17q.1-4.7 4.9-5 4.7-.3 5.7 4.7l.1 17Z" fill={shade}/>
    <path d="m339.9 188.9 9.4-.3m-4.9-14.8.1 11.1m7.4 10.5 14.8-.6m3.8-22.8 5.2-.3v9.8h-5.2Z" strokeWidth=".7"/>
    <path fill={paper} d="m398 149.8 23.3-1 9-3 .4 37-8.8 5.9-23.7.5Z"/>
    <path fill={shade} d="m421.3 148.8 9-3 .4 37-8.8 5.9Z"/>
    <path d="m395.9 149.6 9.7-4.2 26-.9.7 2-10.3 4.1-26.1.6Zm5.4 7.4 5.4-.3.1 7.1-5.3.1Zm11-.5 5-.3.2 7.1-5 .3Z" fill={paper} strokeWidth=".88"/>
    <path d="m398.7 168.2 20.5-.6m-18.6 17.6 5.3-.3.1-10q-2.5-3-5.5.6Zm11-2.7 5-.3v-8.4l-5 .2Z" strokeWidth=".75"/>
    <path stroke={fine} strokeWidth=".62" d="m337.1 169.4 33.2-.9m-33.1 22.2 7.8-.2m26.2-9.8 4.5-.3m-4.1 14.5 5-.3m7.8-21.5 4.7-1.7m-3.7 4.4 3.7-1.4m2.2 10.1 3.9-1.3m-40.6 7.1 7.2-.2m40.7-25.6 12.3-.4"/>
    <path stroke={mid} d="m330.4 200.7 51-.2 18.7-8.6 23.1-.9 12.4-7.8m-99.5 19.3 40.4-.3m29-8.1 16.3-.2"/>
  </g>;
}

