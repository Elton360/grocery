import { PackageOpen } from 'lucide-react'

import { ItemCard } from './ItemCard.jsx'

const EMPTY = {
  new: 'No new items captured yet — import from a store page to start.',
  tracked: 'Nothing tracked yet — items you add to My List show up here.',
  omitted: 'Nothing omitted.',
}

export function SkeletonCards({ n = 3 }) {
  return Array.from({ length: n }, (_, i) => (
    <div className="item-card skeleton" key={i} aria-hidden="true">
      <div className="item-row">
        <span className="thumb" />
        <div className="item-text">
          <span className="bar" />
          <span className="bar short" />
        </div>
      </div>
    </div>
  ))
}

export function ItemList({
  tab,
  items,
  loading,
  selected,
  busyKey,
  onToggle,
  onOmit,
  onRestore,
}) {
  if (loading) {
    return (
      <div className="item-list">
        <SkeletonCards />
      </div>
    )
  }
  if (!items.length) {
    return (
      <div className="item-list empty">
        <PackageOpen size={32} aria-hidden="true" />
        <p>{EMPTY[tab]}</p>
      </div>
    )
  }
  return (
    <div className="item-list">
      {items.map((f) => (
        <ItemCard
          key={f.key}
          f={f}
          selectable={tab === 'new'}
          selected={selected.has(f.key)}
          busy={busyKey === f.key}
          onToggle={() => onToggle(f.key)}
          onOmit={tab === 'new' ? () => onOmit(f.key) : undefined}
          onRestore={tab === 'omitted' ? () => onRestore(f.key) : undefined}
        />
      ))}
    </div>
  )
}
