const TABS = [
  ['new', 'New'],
  ['tracked', 'Tracked'],
  ['omitted', 'Omitted'],
]

/** Segmented control: New | Tracked | Omitted, each with a count pill. */
export function TabBar({ tab, counts, onChange }) {
  return (
    <div className="tab-bar" role="tablist">
      {TABS.map(([id, label]) => (
        <button
          key={id}
          role="tab"
          aria-selected={tab === id}
          className={tab === id ? 'active' : ''}
          onClick={() => onChange(id)}
        >
          {label}
          <span className="count">{counts[id]}</span>
        </button>
      ))}
    </div>
  )
}
