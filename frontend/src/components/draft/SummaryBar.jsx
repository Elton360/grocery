import { ArrowRight, ListChecks, WandSparkles } from 'lucide-react'

import { money } from '../../../../shared/format.js'
import { STORE_META } from '../../lib/meta.js'
import { StartShopping } from './StartShopping.jsx'

/** Sticky summary: what's drafted where, and the next step (resolve gaps or start shopping). */
export function SummaryBar({
  result,
  total,
  addStore,
  onReview,
  onAutoBalance,
}) {
  const assigned = result.lines.filter((l) => l.store).length
  const open = result.missing.length
  const where =
    result.stores.length === 1
      ? `at ${STORE_META[result.stores[0]].name}`
      : `across ${result.stores.length} stores`
  return (
    <div className="summary-bar">
      <span className="sb-icon" aria-hidden="true">
        <ListChecks size={18} />
      </span>
      <div className="sb-text">
        <div className="sb-line">
          Drafting {assigned} of {total} items {where} ({money(result.total)})
          {open > 0 && (
            <>
              {' '}
              •{' '}
              <span className="warn">
                {open} {open === 1 ? 'item' : 'items'} unassigned
              </span>
            </>
          )}
        </div>
        {open > 0 && addStore && (
          <div className="sb-sub">
            Recommended resolution: Add {STORE_META[addStore].name} for complete
            order fulfillment.
          </div>
        )}
      </div>
      <div className="sb-actions">
        {open > 0 ? (
          <>
            <button className="btn-soft" onClick={onReview}>
              Review Single Store Cart
            </button>
            {addStore && (
              <button className="btn-green" onClick={onAutoBalance}>
                <WandSparkles size={14} aria-hidden="true" /> Apply
                Auto-Balancing (Add {STORE_META[addStore].name})
              </button>
            )}
          </>
        ) : (
          <StartShopping>
            Start Shopping <ArrowRight size={14} aria-hidden="true" />
          </StartShopping>
        )}
      </div>
    </div>
  )
}
