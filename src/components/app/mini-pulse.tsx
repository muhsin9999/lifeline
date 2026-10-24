// A donor's last gifts as a tiny heartbeat: one beat per real gift, a coral dip at the end if a gift is failing.
export function MiniPulse({ beats, failing }: { beats: number; failing: boolean }) {
  const W = 96;
  const B = 12;
  const n = Math.min(beats, 12);
  const step = (W - 18) / 13;
  const beat = (x: number) => `L${x - 3},${B} L${x},${B - 9} L${x + 2},${B + 3} L${x + 4},${B}`;
  const path = `M0,${B} ${Array.from({ length: n }, (_, i) => beat(8 + step * (13 - n + i))).join(" ")} L${W - (failing ? 10 : 0)},${B}`;
  return (
    <svg viewBox={`0 0 ${W} 24`} className="h-5 w-24" aria-hidden>
      <path d={path} fill="none" stroke="var(--ink-muted)" strokeWidth={1.25} strokeLinejoin="round" />
      {failing ? <path d={`M${W - 10},${B} L${W - 6},${B + 8} L${W - 3},${B}`} fill="none" stroke="var(--brand)" strokeWidth={1.5} strokeLinejoin="round" /> : null}
    </svg>
  );
}
