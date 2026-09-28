import { plural } from '../../../shared/format.js'
import { ConvergeBar } from './ConvergeBar.jsx'
import { ItemRow } from './ItemRow.jsx'

/**
 * Items added from the side panel that aren't matched to a product yet. Converge proposes how they join
 * the list; Remove puts one on the ignore list.
 */
export function PendingSection({ items, busyKey, onRemove, onConverged }) {
  const byStore = Object.groupBy(items, (i) => i.store)
  return (
    <section className="card pending">
      <div className="card-head">
        <h2>
          Pending{' '}
          <span className="small">
            · {plural(items.length, 'item')} not matched yet
          </span>
        </h2>
        <ConvergeBar onFinished={onConverged} />
      </div>
      {!items.length && (
        <p className="empty small">
          Nothing pending. Items you add from the side panel land here until
          they’re matched.
        </p>
      )}
      {Object.entries(byStore)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([store, list]) => (
          <div key={store}>
            <h3 className={`store s-${store}`}>{store}</h3>
            {list.map((i) => (
              <ItemRow
                key={`${i.store}/${i.store_product_id}`}
                item={i}
                status="pending"
                busy={busyKey === `${i.store}/${i.store_product_id}`}
                onAction={() => onRemove(i)}
              />
            ))}
          </div>
        ))}
    </section>
  )
}
