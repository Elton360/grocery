export function Confidence({ value }) {
  const pct = Math.round((value || 0) * 100)
  return <span className={`conf${pct >= 90 ? ' hi' : ''}`}>{pct}%</span>
}
