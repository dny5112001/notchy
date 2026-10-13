/** A damped spring as a CSS `linear()` easing, for a bouncier feel than cubic-bezier allows. */
export function springEasing(damping = 0.62, frequency = 1.55, samples = 48): string {
  const w = 2 * Math.PI * frequency;
  const wd = w * Math.sqrt(1 - damping * damping);
  const points: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = 1 - Math.exp(-damping * w * t) * (Math.cos(wd * t) + ((damping * w) / wd) * Math.sin(wd * t));
    points.push((i === samples ? 1 : x).toFixed(4));
  }
  const easing = `linear(${points.join(", ")})`;
  return CSS.supports("transition-timing-function", easing) ? easing : "cubic-bezier(0.34, 1.3, 0.64, 1)";
}
