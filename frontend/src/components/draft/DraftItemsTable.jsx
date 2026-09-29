import { CircleX } from 'lucide-react'

import { money } from '../../../../shared/format.js'
import { STORE_META, categoryMeta } from '../../lib/meta.js'
import { QtyStepper } from './QtyStepper.jsx'
import { StatusPill } from './StatusPill.jsx'

const SORTS = [
  ['urgency', 'Stock Urgency'],
  ['store', 'Store'],
  ['price', 'Price'],
  ['name', 'Name'],
]

const isOpen = (l) => !l.store
const rank = { out: 0, low: 1 }
const cmp = {
  urgency: (a, b) =>
    rank[a.status] - rank[b.status] ||
    isOpen(b) - isOpen(a) ||
    a.name.localeCompare(b.name),
  store: (a, b) =>
    (a.store ?? 'zz').localeCompare(b.store ?? 'zz') ||
    a.name.localeCompare(b.name),
  price: (a, b) => (b.lineTotal ?? -1) - (a.lineTotal ?? -1),
  name: (a, b) => a.name.localeCompare(b.name),
}

function Thumb({ line }) {
  if (line.variant?.image_url)
    return <img className="dt-thumb" src={line.variant.image_url} alt="" />
  const Icon = categoryMeta(line.category).icon
  return (
    <span className="dt-thumb fallback" aria-hidden="true">
      <Icon size={16} />
    </span>
  )
}

/** Draft Items Preview: status, item, assigned retailer, quantity stepper, line price. */
export function DraftItemsTable({
  lines,
  anchor,
  sort,
  onSort,
  onQty,
  count,
  id,
}) {
  const rows = [...lines].sort(cmp[sort])
  return (
    <section className="draft-table-wrap" id={id}>
      <div className="dt-header">
        <div>
          <h2>
            Draft Items Preview ({count} {count === 1 ? 'item' : 'items'})
          </h2>
          <p className="small">
            Priority triage based on current inventory states
          </p>
        </div>
        <label className="sort">
          SORT ORDER:
          <select value={sort} onChange={(e) => onSort(e.target.value)}>
            {SORTS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="draft-table" role="table" aria-label="Draft items">
        <div className="dt-row dt-head" role="row">
          <span role="columnheader">Status • Item</span>
          <span role="columnheader">Assigned retailer</span>
          <span role="columnheader">Quantity</span>
          <span role="columnheader" className="num">
            Price
          </span>
        </div>
        {rows.map((l) => {
          const missing = !l.store
          const where = anchor ? STORE_META[anchor].name : 'any store'
          return (
            <div
              key={l.itemId}
              className={`dt-row${missing ? ' missing' : ''}`}
              role="row"
            >
              <span className="dt-item" role="cell">
                <StatusPill status={l.status} />
                <Thumb line={l} />
                <span className="dt-text">
                  <span className="dt-name">{l.name}</span>
                  <span className={`dt-meta${missing ? ' warn' : ''}`}>
                    {missing
                      ? l.reason === 'no_price'
                        ? 'No price at any store'
                        : `Not carried at ${where}`
                      : [categoryMeta(l.category).name, l.variant.name].join(
                          ' • ',
                        )}
                  </span>
                </span>
              </span>
              <span role="cell">
                {missing ? (
                  <span className="retailer missing">
                    <CircleX size={11} aria-hidden="true" />
                    {l.reason === 'no_price'
                      ? 'No price (Missing)'
                      : `Not at ${where} (Missing)`}
                  </span>
                ) : (
                  <span className="retailer" title={l.variant.name}>
                    <span
                      className="store-dot"
                      style={{ background: STORE_META[l.store].dot }}
                      aria-hidden="true"
                    />
                    {STORE_META[l.store].name}
                  </span>
                )}
              </span>
              <span role="cell">
                <QtyStepper
                  name={l.name}
                  qty={l.qty}
                  onChange={(q) => onQty(l.itemId, q)}
                />
              </span>
              <span role="cell" className="num">
                {missing ? (
                  <span className="dt-price warn">
                    ——<small>Unassigned</small>
                  </span>
                ) : (
                  <span className="dt-price">
                    {money(l.lineTotal)}
                    <small>{money(l.unitPrice)} ea</small>
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
