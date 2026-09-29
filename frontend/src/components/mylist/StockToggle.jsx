const STATES = [
  ['in_stock', 'In stock'],
  ['low', 'Low'],
  ['out', 'Out'],
]

/** Compact 3-state stock control: In stock / Low (amber) / Out (red). */
export function StockToggle({ name, status = 'in_stock', busy, onChange }) {
  return (
    <div
      className="stock-toggle"
      role="radiogroup"
      aria-label={`Stock for ${name}`}
    >
      {STATES.map(([id, label]) => (
        <button
          key={id}
          role="radio"
          aria-checked={status === id}
          className={`${id}${status === id ? ' active' : ''}`}
          disabled={busy}
          onClick={() => status !== id && onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
