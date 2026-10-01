import { ExternalLink, Star } from 'lucide-react'

import { money, usDate } from '../../../../shared/format.js'
import { priceState } from '../../../../shared/prices.js'
import { unitText } from '../../../../shared/recommend.js'
import { STORE_META } from '../../lib/meta.js'

/** "est. from Instacart $7.29" / "store confirmed 09/18" / "old price" for Costco estimates. */
function priceNote(v) {
  const ps = priceState(v)
  if (ps.stale) return 'old price'
  if (ps.est) return `est. from Instacart ${money(v.instacart_price)}`
  if (ps.confirmed)
    return `store confirmed ${usDate(ps.confirmed.on).slice(0, 5)}`
  return null
}

/**
 * One store product. `best` highlights it (recommendation); `reason` is the best tile's meta,
 * `savings` a multipack savings message; `detailed` (expanded panel) adds the store dot and notes.
 */
export function VariantTile({
  store,
  v,
  category,
  compareUnit,
  best,
  reason,
  savings,
  detailed,
  onPrefer,
}) {
  const meta =
    best && reason
      ? reason
      : [
          savings || unitText(v.ppu, v.unit, category),
          !v.comparable && 'units differ',
          detailed && v.tier && v.tier !== 'exact' && `${v.tier} match`,
          detailed && v.note,
          priceNote(v),
        ]
          .filter(Boolean)
          .join(' • ')
  return (
    <div
      className={`variant-tile${best ? ' best' : ''}${savings && !best ? ' saves' : ''}`}
    >
      <div className="variant-text">
        <span className="variant-title">
          {detailed && (
            <span
              className="store-dot"
              style={{ background: STORE_META[store].dot }}
              aria-hidden="true"
            />
          )}
          <span className="truncate">
            {STORE_META[store].name}: {v.name}
          </span>
          {detailed && v.url && (
            <a
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${v.name}`}
            >
              <ExternalLink size={11} />
            </a>
          )}
        </span>
        <span className="variant-meta">{meta}</span>
      </div>
      {onPrefer && (
        <button
          className={`star${v.preferred ? ' on' : ''}`}
          onClick={onPrefer}
          title={
            v.preferred ? 'Preferred — click to unstar' : 'Mark as preferred'
          }
          aria-label={`${v.preferred ? 'Unmark' : 'Mark'} ${v.name} as preferred`}
          aria-pressed={Boolean(v.preferred)}
        >
          <Star size={14} fill={v.preferred ? 'currentColor' : 'none'} />
        </button>
      )}
      <span className="variant-price">
        {money(v.price)}
        {v.pack_count > 1 && (
          <small>
            /{v.pack_count} {compareUnit === 'ct' ? 'ct' : 'pk'}
          </small>
        )}
      </span>
    </div>
  )
}
