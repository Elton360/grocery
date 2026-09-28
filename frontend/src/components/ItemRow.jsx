import { money } from '../../../shared/format.js'

/** A gathered store item with its Remove (or Restore) action. */
export function ItemRow({ item: i, status, onAction, busy }) {
  const seen = i.times_seen
    ? ` · seen ${i.times_seen}× · last ${i.last_seen || ''}${i.last_source ? ` (${i.last_source})` : ''}`
    : ` · not bought yet${i.last_seen ? ` · price checked ${i.last_seen}` : ''}`
  return (
    <div className="item-row">
      {i.image_url ? (
        <img src={i.image_url} alt="" loading="lazy" />
      ) : (
        <div className="ph" />
      )}
      <div>
        <div className="name">
          {status === 'converged' && (
            <span className={`store-tag s-${i.store}`}>{i.store}</span>
          )}
          {i.url ? (
            <a href={i.url} target="_blank" rel="noopener noreferrer">
              {i.name}
            </a>
          ) : (
            i.name
          )}
        </div>
        <div className="small">
          id {i.store_product_id}
          {seen}
        </div>
      </div>
      <div className="price">{money(i.last_price)}</div>
      <button
        className={status === 'ignored' ? 'restore' : 'remove'}
        onClick={onAction}
        disabled={busy}
      >
        {status === 'ignored' ? 'Restore' : 'Remove'}
      </button>
    </div>
  )
}
