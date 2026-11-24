import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

const SEQUENCE_DURATION_MS = { desktop: 1800, mobile: 1450 };
const HomeEntranceContext = createContext({ phase: 'done', active: false, finish() {} });

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function initialPhase(active) {
  return active && !prefersReducedMotion() ? 'sequence' : 'done';
}

export function HomeEntranceProvider({ children }) {
  const { pathname } = useLocation();
  const active = pathname === '/';
  const [phase, setPhase] = useState(() => initialPhase(active));
  const played = useRef(active);
  const finish = useCallback(() => setPhase('done'), []);

  useLayoutEffect(() => {
    if (!active) { setPhase('done'); return; }
    if (!played.current) {
      played.current = true;
      setPhase(initialPhase(true));
    }
  }, [active]);

  useLayoutEffect(() => {
    if (!active) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = () => { if (media.matches) finish(); };
    media.addEventListener('change', onMotionChange);
    if (media.matches) finish();
    return () => media.removeEventListener('change', onMotionChange);
  }, [active, finish]);

  useLayoutEffect(() => {
    if (!active || phase === 'done') return;
    const duration = window.matchMedia('(max-width: 700px)').matches ? SEQUENCE_DURATION_MS.mobile : SEQUENCE_DURATION_MS.desktop;
    const timer = setTimeout(finish, duration);
    const onEscape = event => {
      if (event.key === 'Escape') finish();
    };
    document.addEventListener('keydown', onEscape);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', onEscape); };
  }, [active, phase, finish]);

  useLayoutEffect(() => {
    const html = document.documentElement;
    if (!active) { delete html.dataset.homeIntro; return; }
    html.dataset.homeIntroSeen = 'true';
    html.dataset.homeIntro = phase;
    return () => { delete html.dataset.homeIntro; };
  }, [active, phase]);

  const value = useMemo(() => ({ active, phase: active ? phase : 'done', finish }), [active, phase, finish]);
  return <HomeEntranceContext.Provider value={value}>{children}</HomeEntranceContext.Provider>;
}

export function useHomeEntrance() { return useContext(HomeEntranceContext); }
