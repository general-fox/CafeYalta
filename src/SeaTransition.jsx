export default function SeaTransition({ to = 'blue' }) {
  return <div className={`home-section-wave home-section-wave--${to}`} aria-hidden="true">
    <svg viewBox="0 0 1440 72" preserveAspectRatio="none"><path d="M0 28C180 0 300 68 480 38S780 2 960 30S1260 69 1440 28V72H0Z"/></svg>
  </div>;
}
