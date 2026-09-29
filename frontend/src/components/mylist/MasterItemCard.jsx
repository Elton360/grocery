import { ChevronDown } from 'lucide-react'

import { money } from '../../../../shared/format.js'
import { STORES, headline } from '../../../../shared/prices.js'
import { unitText, variantKey } from '../../../../shared/recommend.js'
import { relativeDay } from '../../lib/dates.js'
import { STORE_META } from '../../lib/meta.js'
import { StockToggle } from './StockToggle.jsx'
import { VariantTile } from './VariantTile.jsx'

function lastBought(product) {
  const seen = STORES.flatMap((s) => product.stores[s].versions)
    .filter((v) => v.times_seen > 0 && v.last_seen)
    .map((v) => v.last_seen)
    .sort()
  return seen.at(-1)
}

/**
 * A master item: name, store count, last bought, recommended store + price, and its store variants —
 * a strip of each store's best version (collapsed) or every version in a 2-column grid (expanded).
 */
export function MasterItemCard({
  product: p,
  rec,
  expanded,
  onToggle,
  stock,
  stockBusy,
  onStock,
  onPrefer,
}) {
  const stores = STORES.filter((s) => p.stores[s].versions.length)
  const notCarried = STORES.filter(
    (s) => !p.stores[s].versions.length && p.stores[s].not_carried,
  )
  const bought = lastBought(p)
  const meta = [
    bought ? `Last bought: ${relativeDay(bought)}` : 'Not bought yet',
    notCarried.length > 0 &&
      `Not carried at ${notCarried.map((s) => STORE_META[s].name).join(', ')}`,
  ].filter(Boolean)
  const isBest = (s, v) => rec && rec.store === s && rec.version === v
  const bestValue =
    rec &&
    (rec.kind === 'best_unit_cost'
      ? unitText(rec.version.ppu, rec.version.unit, p.category)
      : money(rec.version.price))
  const panelId = `variants-${p.id}`

  return (
    <article
      className={`master-card${expanded ? ' expanded' : ''} stock-${stock ?? 'in_stock'}`}
    >
      <div className="master-top">
        <button
          className="master-head"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span className="master-text">
            <span className="master-name">
              {p.name}
              {stores.length > 1 && (
                <span className="tag options">
                  {stores.length} Store Options
                </span>
              )}
            </span>
            <span className="master-meta">{meta.join(' • ')}</span>
          </span>
          {rec && (
            <span className="best-block">
              <span className="best-label">{rec.label}</span>
              <span
                className={`best-value${rec.kind === 'best_unit_cost' ? ' win' : ''}`}
              >
                {bestValue} ({STORE_META[rec.store].name})
              </span>
            </span>
          )}
          <ChevronDown className="chevron" size={18} aria-hidden="true" />
        </button>
        <StockToggle
          name={p.name}
          status={stock}
          busy={stockBusy}
          onChange={onStock}
        />
      </div>

      {expanded ? (
        <div className="variants-panel" id={panelId}>
          <div className="variants-head">
            <span>Linked store variants</span>
            <span className="best-text">Best value highlighted</span>
          </div>
          <div className="variants-grid">
            {STORES.flatMap((s) =>
              p.stores[s].versions.map((v) => (
                <VariantTile
                  key={variantKey(s, v)}
                  store={s}
                  v={v}
                  category={p.category}
                  compareUnit={p.compare_unit}
                  compareUnit={p.compare_unit}
                  best={isBest(s, v)}
                  reason={rec?.reason}
                  savings={rec?.savings.get(variantKey(s, v))}
                  detailed
                  onPrefer={() => onPrefer(s, v)}
                />
              )),
            )}
            {notCarried.map((s) => (
              <div className="variant-tile muted" key={s}>
                <div className="variant-text">
                  <span className="variant-title">
                    <span
                      className="store-dot"
                      style={{ background: STORE_META[s].dot }}
                      aria-hidden="true"
                    />
                    {STORE_META[s].name}: not carried
                  </span>
                  <span className="variant-meta">
                    {p.stores[s].not_carried.note} (
                    {p.stores[s].not_carried.checked_on})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="variant-strip" id={panelId}>
          {stores.map((s) => {
            const v = headline(p, s) ?? p.stores[s].versions[0]
            return (
              <VariantTile
                key={s}
                store={s}
                v={v}
                category={p.category}
                compareUnit={p.compare_unit}
                best={isBest(s, v)}
                reason={rec?.reason}
                savings={rec?.savings.get(variantKey(s, v))}
              />
            )
          })}
        </div>
      )}
    </article>
  )
}
