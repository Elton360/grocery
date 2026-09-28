import { ItemRow } from './ItemRow.jsx'

/** Omitted/removed items (future imports skip them); Restore puts one back as pending. */
export function IgnoredSection({ items, busyKey, onRestore }) {
  if (!items.length) return null
  return (
    <details className="card ignored">
      <summary>
        <h2>
          Ignored{' '}
          <span className="small">· {items.length} — imports skip these</span>
        </h2>
      </summary>
      {items.map((i) => (
        <ItemRow
          key={`${i.store}/${i.store_product_id}`}
          item={i}
          status="ignored"
          busy={busyKey === `${i.store}/${i.store_product_id}`}
          onAction={() => onRestore(i)}
        />
      ))}
    </details>
  )
}
