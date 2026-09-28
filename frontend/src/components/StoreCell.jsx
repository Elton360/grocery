import { money, usDate } from '../../../shared/format.js'
import {
  CONFIRMED_MAX_DAYS,
  fmtUnit,
  headline,
  priceState,
} from '../lib/prices.js'

function VersionLink({ v }) {
  return v.url ? (
    <a href={v.url} target="_blank" rel="noopener noreferrer">
      {v.name}
    </a>
  ) : (
    v.name
  )
}

function MoreVersions({ versions, category }) {
  if (!versions.length) return null
  return (
    <details className="more">
      <summary>
        + {versions.length} more version{versions.length > 1 ? 's' : ''}
      </summary>
      {versions.map((v) => {
        const vs = priceState(v)
        return (
          <div className="ver" key={v.store_product_id}>
            <span className="vp">{money(v.price)}</span>
            {vs.est && <span className="badge est">est.</span>}
            {vs.stale && <span className="badge">old price</span>}
            {!v.comparable && <span className="badge">units differ</span>}
            {' · '}
            {fmtUnit(v.ppu, v.unit, category)}
            <br />
            <VersionLink v={v} />
            {v.note && <small>{v.note}</small>}
          </div>
        )
      })}
    </details>
  )
}

/** One store's cell on the compare table: best version, price state, and the other versions. */
export function StoreCell({ product, store, winner, markup }) {
  const st = product.stores[store]
  if (!st.versions.length) {
    return (
      <td className="cell">
        {st.not_carried ? (
          <small>
            {st.not_carried.note || 'not carried'} (
            {st.not_carried.checked_on || ''})
          </small>
        ) : (
          <span className="empty">—</span>
        )}
      </td>
    )
  }
  const h = headline(product, store)
  if (!h) {
    return (
      <td className="cell">
        <small>
          no current price (store price over {CONFIRMED_MAX_DAYS} days old)
        </small>
      </td>
    )
  }
  const ps = priceState(h)
  const checked =
    !h.times_seen && h.last_seen && !ps.confirmed
      ? `checked ${usDate(h.last_seen)}`
      : ''
  const meta = [
    h.tier && h.tier !== 'exact' ? `${h.tier} match` : '',
    h.note,
    checked,
  ]
    .filter(Boolean)
    .join(' · ')
  const estTitle = h.instacart_price
    ? `Instacart ${money(h.instacart_price)} ÷ ${markup.toFixed(2)}`
    : ''

  return (
    <td className={`cell${winner === store ? ' win' : ''}`}>
      <div className="price">
        {money(h.price)}
        {ps.est && (
          <span className="badge est" title={estTitle}>
            est.
          </span>
        )}
        {!h.comparable && <span className="badge">units differ</span>}
      </div>
      <div className="ppu">{fmtUnit(h.ppu, h.unit, product.category)}</div>
      {ps.confirmed && (
        <small>
          {ps.confirmed.price !== null && `${money(ps.confirmed.price)} `}(store
          confirmed {usDate(ps.confirmed.on)})
        </small>
      )}
      {h.alt_ppu !== undefined && h.alt_unit !== h.unit && (
        <small>{fmtUnit(h.alt_ppu, h.alt_unit, product.category)}</small>
      )}
      {store === 'costco' && h.instacart_price && (
        <small>Instacart {money(h.instacart_price)}</small>
      )}
      {meta && <small title={meta}>{meta}</small>}
      <small>
        <VersionLink v={h} />
      </small>
      <MoreVersions
        versions={st.versions.filter((v) => v !== h)}
        category={product.category}
      />
    </td>
  )
}
