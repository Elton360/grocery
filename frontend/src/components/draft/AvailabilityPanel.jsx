import { Fragment } from 'react'
import {
  ArrowRight,
  Check,
  Info,
  Repeat,
  ShoppingCart,
  Tag,
} from 'lucide-react'

import { money } from '../../../../shared/format.js'
import { STORE_META } from '../../lib/meta.js'

/** "a, b and c" with each name in bold. */
function Names({ list }) {
  return list.map((n, i) => (
    <Fragment key={n}>
      {i > 0 && (i === list.length - 1 ? ' and ' : ', ')}
      <b>{n}</b>
    </Fragment>
  ))
}

/** What the One Store choice doesn't cover, with three computed ways to resolve it. */
export function AvailabilityPanel({
  anchor,
  res,
  itemsById,
  total,
  noPriceCount,
  onAdd,
  onAll,
  onLeave,
}) {
  const missing = res.base.missing.map((id) => itemsById.get(id).product.name)
  const A = STORE_META[anchor].name
  const add = res.addStore
  const combined = (d) => money(res.base.total + d.delta)
  return (
    <section className="availability" aria-label="Availability">
      <div className="gap-notice">
        <span className="gap-icon" aria-hidden="true">
          <ShoppingCart size={16} />
        </span>
        <div>
          <div className="gap-title">
            {missing.length} of {total} items aren’t available at {A}
            <span className="action-needed">ACTION NEEDED</span>
          </div>
          <div className="gap-sub">
            Missing catalog matches: <Names list={missing} />.
          </div>
        </div>
        <span className="gap-when">
          <Info size={11} aria-hidden="true" /> Based on your latest imports
        </span>
      </div>
      <div className="resolutions">
        {add && (
          <div className="resolution">
            <div className="res-eyebrow">
              OPTION A • RECOMMENDED
              {add.covers === missing.length && (
                <span className="badge-mint">100% COVERAGE</span>
              )}
            </div>
            <div className="res-title">Add {STORE_META[add.store].name}</div>
            <p>
              Covers{' '}
              {add.covers === missing.length
                ? missing.length === 2
                  ? 'both'
                  : 'all'
                : add.covers}{' '}
              missing {add.covers === 1 ? 'item' : 'items'}, and moves anything
              preferred or much cheaper there.
            </p>
            <div className="res-cost">
              +{money(add.delta)}{' '}
              <small>({combined(add)} combined total)</small>
            </div>
            <button className="res-btn dark" onClick={onAdd}>
              Balance with {STORE_META[add.store].name} <ArrowRight size={14} />
            </button>
          </div>
        )}
        <div className="resolution">
          <div className="res-eyebrow">OPTION B</div>
          <div className="res-title">Best of 3 stores</div>
          <p>
            Distributes items for the best pricing across every store, keeping{' '}
            {A} as your main stop.
          </p>
          <div className="res-cost">
            +{money(res.bestOfAll.delta)}{' '}
            <small>({combined(res.bestOfAll)} combined total)</small>
          </div>
          <button className="res-btn light" onClick={onAll}>
            Switch to 3 Stores <Repeat size={14} />
          </button>
        </div>
        <div className="resolution">
          <div className="res-eyebrow">OPTION C</div>
          <div className="res-title">Leave them off</div>
          <p>
            Proceed strictly with {A}. Missing items stay marked Low/Out for
            your next trip.
          </p>
          <div className="res-cost">
            +$0.00 <small>(Strict {money(res.base.total)} total)</small>
          </div>
          <button className="res-btn muted" onClick={onLeave}>
            Proceed with {A} only <Check size={14} />
          </button>
        </div>
      </div>
      {noPriceCount > 0 && (
        <p className="no-price-note">
          <Tag size={11} aria-hidden="true" /> Note: {noPriceCount}{' '}
          {noPriceCount === 1 ? 'item has' : 'items have'} no price at any
          store; {noPriceCount === 1 ? 'it stays' : 'they stay'} marked Low/Out.
        </p>
      )}
    </section>
  )
}
