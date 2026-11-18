import { useEffect, useRef } from 'react';
import HarborVillage from './HarborVillage';
import './hero-sea-art.css';

function HarborWater() {
  return <g fill="none" strokeLinecap="round" strokeLinejoin="round">
    <defs>
      <pattern id="harbor-water-etch" width="77" height="8.3" patternUnits="userSpaceOnUse">
        <path d="M-2 1q13 .4 32 0t31-.3m4 0h14M3 3.7q16-.7 34-.1t34-.2M-4 6.7l18-.4m5-.3c17-.4 38 .7 62-.3" stroke="var(--harbor-mid)" strokeWidth=".7"/>
      </pattern>
      <pattern id="harbor-rock-etch" width="7" height="23" patternUnits="userSpaceOnUse" patternTransform="rotate(11)">
        <path d="M1-3v18m.2 2v7M3.7 2l.3 21M6-1v9m-.2 2v6" stroke="var(--harbor-fine)" strokeWidth=".78"/>
      </pattern>
    </defs>
    <g fill="url(#harbor-water-etch)">
      <path d="M95 145q46-2 82-4c35-4 78-4 114 2l45 9c-21-1-43 4-71 3l-53-1c-17 0-27-3-38-2 21-1 46-.2 57-2-39-2-92 .1-136-5Z"/>
      <path d="M151 159c31-4 65-1 97-4 43-3 68-8 100-6l40 12c-20 11-71 18-121 17-43 0-57-3-80-2 35-2 78-4 86-7-29-2-56 .3-86-.6l35-3c-17-2-42-.7-71-5.4Z"/>
      <path d="M178 193c30-3 66-3 91-7l84-19 51 24c-13 7-21 11-46 16-31 6-79 7-126 7l42-5-70-.6c23-3 46-3 66-6-20-1-44 .1-60-.7l39-4c-18-2-43-1.5-71-4.7Z"/>
      <path d="M218 232c30-2 68-3 92-9l65-27 60 12-54 31c-31 7-60 11-91 11l36-6c-20 0-42 2-69 1 23-3 35-4 57-8-37 0-59-.7-96-5Z"/>
      <path d="M261 267c27-4 62-7 86-16l38-17 42 10-35 28c-28 4-55 5-91 7l42-8c-28-.8-51 .7-82-4Z"/>
    </g>
    <g className="harbor-ripples" stroke="var(--harbor-mid)" strokeWidth=".87">
      <path d="m62 143 11-.6m9 .3q16-.8 31-.6m-35 5.7 12-.3m6-.2 26-.7m-17 4.4 12-.3m10-.4 21-.8m-37 4.4 27-1m23 .7 17-.5m-73 4.9 10-.2m13 .4 35-1.1"/>
      <path d="m121 167 32-1m6-.6 21-.5m-29 7.6 22-.7m-31 5.1 15-.4m12 1.2 29-.9m-48 7.5 12-.2m17 .3 35-1m-47 7.2 18-.6m-36 5.7 10-.3m19 .7 30-.7"/>
      <path d="m170 211 19-.4m-9 5.4 35-1.1m-60 6.7 22-.7m19-.1 26-1m-64 8.3 10-.3m14 1.1 39-.9m-26 8.3 18-.5m-3 8.1 32-.9m-39 10.1 19-.5m8 .1 25-1.4m-12 9.3 16-.7m-25 12.8 23-.6"/>
    </g>
  </g>;
}

function Shoreline() {
  return <g strokeLinecap="round" strokeLinejoin="round">
    <path d="M113 138l9-6 9 .8 7-4 5 2 16-4 16-10 13 .7 11-6 18-4 12-10 21-3 17-15 14-3 8-7 19-4 16-13 12 .5 14-11 13-4 5-6 12 2 7-8 13-2 12-9 7-.8 9-10 19-8" className="harbor-ridge"/>
    <path d="M121 136l11-4 2 3 11-2m19-7 6-2 7-7m7 2 7-3m15-4 12-5m23-10 6 .4 7-5m29-14 6-4m24-7 6-2 10-8m22-12 8-.9m37-15 11-2 8-7m19-10 9-5" className="harbor-fissures"/>
    <path d="m102 143 5-4 10-2 3-4 13 1 4 4 11 .8 7 4-11 1-8-1-11 1Zm56-2 9-3 5 1 8-2 3 2 8 1-12 3-19 1Z" className="harbor-rocks"/>
    <path d="m111 141 7-3m7-2-1 4m3-3-1 4m6-5-.5 4m9 .3 4 1.2m21-.7 5-1" className="harbor-fissures"/>
    <path className="harbor-cliff" d="M171 142q24-2 38-9l14-2 25 2 14 2 24-5 26 5 17 11 26 8 25-2 27 11 33-12 24 9v108l-39 14-13 12-18-3-14-9-16 3-15-4 5-8-12-5 8-10-14-3-6-8-15-2-6-5 11-5 16-5 8-8-19-9-12 2-13-5-11 1-13-4 8-6 11-5 9-7 19-5 11-12 13-5-13-10-29 .3-14-4-23 1.5-32-4-19 .1-22-4-15 1-15-3-18 .9Z"/>
    <g fill="url(#harbor-rock-etch)">
      <path d="M376 65l14-2 30-2 15-6 8-10 13-7 6-7v19l-9 2-5 10-9 2-4 10-18 6-21 1-10 8-14 3 10-10 24-9 6-4-22 3-24 10Z"/>
      <path d="m324 94 16-8 25 .6 19-9 10-.5 14-8-1 9-11 5-4 6-17 7-11-.2-9 7-13 1-15 8-12 2 10-7 15-8 6-4-13 1-15 9Z"/>
      <path d="m272 125 26-1 19-5 12-13 8-2 10-8 15 .5-12 10-4 8-13 4-14 12-23 1-10 5-17-2 12-3 17-1 9-5-17 3Z"/>
      <path d="m341 144 12-7 18-.5 15-7 22-2 10-9 13-4 9-8 19-7v6l-13 9-7 10-14 4-12 11-25 3-8 8-18 1-12 6 11-12-14 3Z"/>
      <path d="m326 202 22-5 32-2 24-12 23 .5 18-9-15 16-22 6-13 6-24 2-12 8-18 3 8-7 20-5-30 .2-16 7Z"/>
    </g>
    <g className="harbor-fissures">
      <path d="m385 69 17-.5 21-2 13-7m-28 16 12-2 12-6m-63 28 12-3 6-5 13-5 9-8m-60 33 10-5 12-.5 7-5m20 .4 12-6 8-2m8-5 7-5 10-3 11-10"/>
      <path d="m312 128 10-3 16-13 10-4m18 10 13-1 11-6 8-1m-55 19 8-5 13-1m-5 16 16-4 11-5 18-1 12-5m11 3 10-2 15-11m-20 24 8-2 10-7"/>
      <path d="m332 203 16-.6 13-.5m25-.6 11-4 15-2m10-3 9-4 8-2m-13 14 17-5 13-8m-12 22 6-2 12-10m-62 69 10-5 7-5 10-1 7-5m-32 23 9-4 4-4m12-22 6-1 4-6 9-3"/>
    </g>
    <g stroke="var(--harbor-mid)" strokeWidth=".87" fill="none">
      <path d="M205 152c8 1 17 .8 25-1-5 4-17 5-23 3Zm3 0 4-2 8 .1 5 1m-10-.9 .3-5m-.1 1 4 3"/>
      <path d="M241 155l9-2.5 9 .6-5 2.2-10 .9Zm4-1.4 5-2 4 .3M236 158l15 .1m-44-.5 16-.5"/>
    </g>
    <g fill="url(#harbor-rock-etch)">
      <path d="m177 142 35-8 24 1 16 6-15-2-12 .5-8-3-17 4 18-1.5 18 6-33-4-12 2Zm52 4 29 2 17-1 15 2 14-.2 13 4-24-.5-12 2-14-4-21-.2Z"/>
      <path d="m276 196 15-9 18-3 18-11 15-9-7 11-7 2.8-9 13-12 1-8 4.2-7-2-9 4Zm19 2 13-4 14-1 15 7-9-2-9 4-9-.5Z"/>
      <path d="m313 241 17-9 13-6 6-8 17-3 18-12 14 3-9 11-9 2-7 8-15 4-9 7-14-.6-9 6Zm35 23 11-10 8-9 13-2.5 17-11 11 4-11 6-6 9-13 2-8 8-9 2-8 5Z"/>
      <path d="m371 278 12-10 14-3 15-11 15 .5 11-9 15-2-8 8-10 5-15 9-10 8-19 1-10 7Z"/>
    </g>
    <g className="harbor-fissures">
      <path d="m184 138 17-4 8-3m9 4 13 3 8-.8 7 4m9 2 16-2 8 2m14 4 13-1 15 4m-48 47 10-2 5-4 11-2 9-7m-4 15 9-1 7 3 7-.6m-21 34 14-3 9-6 4-6m-5 17 5-2m9 .9 5-2m-11 14 14 3 6-2 9 2m-18 13 6-6 6-.4 10-8m-7 16 8-2 5-5m14 18 8-7 14-4 8-6"/>
      <path d="m305 185 2-6 5-3m-16 17 2-3m48 35 2-5m21 17 7-1 9-5m38-15 4-6 7-3m-2-22 7-3 4-6m4 8 6-3"/>
    </g>
  </g>;
}

function HarborBoat() {
  return <g transform="translate(34 177)" fill="none" strokeLinecap="round" strokeLinejoin="round">
    <g className="harbor-boat">
      <path className="harbor-sails" d="M46 7c-2 19-10 42-23 57 11-2 18-3 28-1Zm5 9c9 16 17 31 29 42-9 .6-16 1.8-23 4-1-15-2.8-29-6-46Z"/>
      <path stroke="var(--harbor-mid)" strokeWidth=".72" d="m42 29 4 .9m-8 10 9 1m-15 12 16 .6m8-22 3 3m-1 10 8 2m-7 8 13 1m-49 7 24-3"/>
      <path stroke="var(--harbor-ink)" strokeWidth="1.12" d="M45 4l9 65m-8-62L17 69m30-62 39 56M20 66q15-3 32-2m3-.3 24-5.4m-35-53 1-2 5 2-4 .9"/>
      <path fill="var(--harbor-paper)" stroke="var(--harbor-ink)" strokeWidth="1.32" d="M14 67c15 2.5 36 4 56 .9l17-5.5c-5.5 9-12 13-23 15-17 2.6-32 .2-44-3.5Z"/>
      <path fill="url(#harbor-rock-etch)" d="M21 71c20 5 46 6 60-2l-7 5c-17 7-38 5-51 0Z"/>
      <path stroke="var(--harbor-mid)" strokeWidth=".9" d="M19 69q26 6 52 .5l9-3M32 69l4-4 12-.4 4 5m6 .2 4-4 7-.5 4 2m-34-1 5 .2m10 8 13-.7"/>
    </g>
    <g className="harbor-ripples" stroke="var(--harbor-mid)" strokeWidth=".78">
      <path d="m4 79 18-.6m3 .3q20 3 48 .1l13-.7m-76 3.3 18-.2 16 .6 22-.5m4-.3 17-.7M18 85l25 .4m5 .1 22-1.1m-42 4.6 25-.1m8-1 10-.8m-32 5.6 19-.7"/>
    </g>
  </g>;
}

export function HarborIllustration({ moving }) {
  const boatLayer = useRef(null);

  useEffect(() => {
    if (!moving) return;
    const layer = boatLayer.current;
    const panel = layer.ownerSVGElement.parentElement;
    const parallax = window.matchMedia('(min-width: 701px) and (prefers-reduced-motion: no-preference)');
    let frame = 0;

    const update = () => {
      frame = 0;
      const progress = Math.max(0, Math.min(1, window.scrollY / Math.max(1, panel.offsetTop + panel.clientHeight)));
      layer.style.setProperty('--boat-progress', String(progress));
    };
    const schedule = () => {
      if (parallax.matches && !frame) frame = requestAnimationFrame(update);
    };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    parallax.addEventListener('change', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      parallax.removeEventListener('change', schedule);
    };
  }, [moving]);
  return <svg className="harbor-vignette" viewBox="0 0 460 300" fill="none" aria-hidden="true" focusable="false">
    <HarborWater/>
    <Shoreline/>
    <HarborVillage/>
    <g ref={boatLayer} className="harbor-boat-parallax"><HarborBoat/></g>
  </svg>;
}
