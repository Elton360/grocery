import {
  Check,
  Heart,
  PiggyBank,
  SplitSquareHorizontal,
  Store,
  ThumbsUp,
  TrendingDown,
  TriangleAlert,
  Zap,
} from 'lucide-react'

import { money } from '../../../../shared/format.js'
import { STORE_META } from '../../lib/meta.js'

const coverText = (r, total) => {
  const n = r.stores.length
  const stores = `${n} ${n === 1 ? 'store' : 'stores'}`
  if (r.missing.length)
    return [`${stores} • ${r.missing.length} unavailable`, true]
  return [
    `${stores} • ${r.lines.length - r.noPrice.length === total ? 'all items' : 'all priced items'}`,
    false,
  ]
}

/** "Saves $X vs Baseline": only when cheaper than My Preferences and covering every item. */
function savingsNote(r, baseline) {
  if (r.missing.length || r.total >= baseline.total) return null
  return `Saves ${money(baseline.total - r.total)} vs Baseline`
}

/** The four strategy cards (radio group). The One Store card carries its store dropdown. */
export function StrategyCards({
  results,
  selected,
  onSelect,
  oneStore,
  onOneStore,
  stores,
  pricedCount,
}) {
  const base = results.preferences
  const cards = [
    {
      id: 'cheapest',
      name: 'Cheapest',
      corner: (
        <span className="corner-check" aria-hidden="true">
          <Check size={13} />
        </span>
      ),
      icon: Store,
      foot: savingsNote(results.cheapest, base),
      footIcon: PiggyBank,
    },
    {
      id: 'preferences',
      name: 'My Preferences',
      corner: <span className="badge-neutral">BASELINE</span>,
      icon: Heart,
      foot: 'Keeps your preferred picks',
      footIcon: ThumbsUp,
    },
    {
      id: 'one',
      name: 'One Store',
      corner: (
        <select
          className="store-select"
          value={oneStore}
          aria-label="Store for One Store"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onOneStore(e.target.value)}
        >
          {stores.map((s) => (
            <option key={s} value={s}>
              {STORE_META[s].name}
            </option>
          ))}
        </select>
      ),
      suffix: 'basket',
      icon: TriangleAlert,
      foot: 'Fastest single stop',
      footIcon: Zap,
    },
    {
      id: 'two',
      name: 'Up to 2 Stores',
      corner: <span className="badge-mint">SMART SPLIT</span>,
      icon: SplitSquareHorizontal,
      foot: savingsNote(results.two, base),
      footIcon: TrendingDown,
    },
  ]
  return (
    <div
      className="strategy-cards"
      role="radiogroup"
      aria-label="Procurement strategy"
    >
      {cards.map((c) => {
        const r = results[c.id]
        const [meta, warn] = coverText(r, pricedCount)
        const Icon = warn ? TriangleAlert : c.id === 'one' ? Store : c.icon
        const FootIcon = c.footIcon
        const saves = c.foot?.startsWith('Saves')
        return (
          <div
            key={c.id}
            role="radio"
            tabIndex={0}
            aria-checked={selected === c.id}
            className={`strategy-card${selected === c.id ? ' selected' : ''}`}
            onClick={() => onSelect(c.id)}
            onKeyDown={(e) =>
              (e.key === 'Enter' || e.key === ' ') && onSelect(c.id)
            }
          >
            <div className="sc-body">
              <div className="sc-top">
                <span className="sc-name">{c.name}</span>
                {c.corner}
              </div>
              <div className="sc-price">
                {money(r.total)} <small>{c.suffix ?? 'total'}</small>
              </div>
              <div className={`sc-meta${warn ? ' warn' : ''}`}>
                <Icon size={12} aria-hidden="true" /> {meta}
              </div>
            </div>
            <div className="sc-foot">
              <span className={saves ? 'saves' : ''}>{c.foot ?? ' '}</span>
              {c.foot && <FootIcon size={12} aria-hidden="true" />}
            </div>
          </div>
        )
      })}
    </div>
  )
}
