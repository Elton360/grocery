import { money } from '../../../shared/format.js'

const TAGS = { converged: 'on list', pending: 'pending', ignored: 'ignored' }

/** One grabbed item in the review list, with an optional checkbox in front. */
export function ItemLine({ row, control, off }) {
  const it = row.item
  return (
    <label className={`line${off ? ' off' : ''}`}>
      {control}
      {it.image_url ? (
        <img src={it.image_url} alt="" />
      ) : (
        <span className="ph" />
      )}
      <span className="what">
        <span className="name">
          {it.name}
          {TAGS[row.status] && (
            <span className="badge">{TAGS[row.status]}</span>
          )}
        </span>
        <span className="small">
          {[
            it.size_text,
            it.qty > 1 && `qty ${it.qty}`,
            it.notes,
            it.store_product_id || 'no id',
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <span className="amt">{money(it.price_each)}</span>
    </label>
  )
}
