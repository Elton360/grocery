import { TrendingDown } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import {
  bestSingleStore,
  buildDraft,
  cheapestFullSingle,
  draftItems,
  resolutions,
  strategies,
} from '../../../shared/draft.js'
import { money, usDate } from '../../../shared/format.js'
import { STORES } from '../../../shared/prices.js'
import { api } from '../api.js'
import { AvailabilityPanel } from '../components/draft/AvailabilityPanel.jsx'
import { BalancedView } from '../components/draft/BalancedView.jsx'
import { DraftItemsTable } from '../components/draft/DraftItemsTable.jsx'
import { StrategyCards } from '../components/draft/StrategyCards.jsx'
import { SummaryBar } from '../components/draft/SummaryBar.jsx'
import { Link } from '../components/Link.jsx'
import { useLoad } from '../hooks/useLoad.js'
import { STORE_META } from '../lib/meta.js'

/** sessionStorage-backed state (quantities, last strategy) that survives reloads within the session. */
function useSession(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key)
      return raw === null ? initial : JSON.parse(raw)
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      // storage unavailable: keep in memory only
    }
  }, [key, value])
  return [value, setValue]
}

function latestPriceDate(products) {
  let latest = ''
  for (const p of products)
    for (const s of STORES)
      for (const v of p.stores[s].versions)
        if (v.last_seen > latest) latest = v.last_seen
  return latest
}

/**
 * Draft Grocery List (stage 2): Low/Out items → strategy → resolve gaps → auto-balanced trip plan.
 * Every number is computed by shared/draft.js.
 */
export function DraftPage() {
  const compare = useLoad(() => api.compare(), [])
  const stockLoad = useLoad(() => api.stock(), [])
  const [qty, setQty] = useSession('draft.qty', {})
  const [strategy, setStrategy] = useSession('draft.strategy', 'preferences')
  const [oneStoreChoice, setOneStore] = useSession('draft.oneStore', null)
  const [sort, setSort] = useState('urgency')
  const [leftOff, setLeftOff] = useState(false)
  const [storeFilter, setStoreFilter] = useState(null)
  // { kind: 'add' | 'all', anchor, stores } while the auto-balanced view is shown
  const [balanced, setBalanced] = useSession('draft.balanced', null)

  const products = useMemo(() => compare.data?.products ?? [], [compare.data])
  const stock = useMemo(() => stockLoad.data ?? {}, [stockLoad.data])
  const items = useMemo(
    () => draftItems(products, stock, qty),
    [products, stock, qty],
  )
  const itemsById = useMemo(
    () => new Map(items.map((i) => [i.product.id, i])),
    [items],
  )
  const activeStores = useMemo(
    () =>
      STORES.filter((s) => products.some((p) => p.stores[s].versions.length)),
    [products],
  )
  const oneStore =
    oneStoreChoice && activeStores.includes(oneStoreChoice)
      ? oneStoreChoice
      : items.length
        ? bestSingleStore(items, activeStores)
        : activeStores[0]

  const results = useMemo(
    () => (items.length ? strategies(items, oneStore) : null),
    [items, oneStore],
  )
  const res = useMemo(
    () =>
      items.length && strategy === 'one'
        ? resolutions(items, oneStore, activeStores)
        : null,
    [items, strategy, oneStore, activeStores],
  )
  const balancedResult = useMemo(
    () =>
      balanced && items.length
        ? buildDraft({
            items,
            allowedStores: balanced.stores,
            honorPreferences: true,
            anchorStore: balanced.anchor,
          })
        : null,
    [balanced, items],
  )
  const single = useMemo(
    () => (items.length ? cheapestFullSingle(items, activeStores) : null),
    [items, activeStores],
  )

  const setItemQty = (id, q) => setQty((m) => ({ ...m, [id]: Math.max(1, q) }))
  const chooseStrategy = (id) => {
    setStrategy(id)
    setLeftOff(false)
    setStoreFilter(null)
  }

  if (compare.error || stockLoad.error) {
    return (
      <p className="empty err">{(compare.error ?? stockLoad.error).message}</p>
    )
  }
  if (!results && (!compare.data || !stockLoad.data))
    return <p className="empty">Loading…</p>
  if (!results) {
    return (
      <div className="container draft-empty">
        <h1>Nothing’s running low</h1>
        <p className="subtitle">
          Mark items Low or Out on <Link to="/my-list">My Grocery List</Link>{' '}
          and they’ll show up here.
        </p>
      </div>
    )
  }

  const pricedCount = items.length - results.cheapest.noPrice.length
  const baseline = results.preferences
  const bestDelta = Math.max(
    0,
    ...Object.values(results).map((r) =>
      baseline.total ? (baseline.total - r.total) / baseline.total : 0,
    ),
  )
  const synced = latestPriceDate(products)

  const header = (
    <header className="draft-header">
      <div>
        <div className="eyebrow">
          <span className="dot" aria-hidden="true" /> OPTIMIZATION ENGINE •
          STAGE 2 OF 3
        </div>
        <h1>Draft Grocery List</h1>
        <p className="subtitle">
          {items.length} {items.length === 1 ? 'item' : 'items'} from your Low
          and Out list. • <b>Ready for automated basket allocation</b>
        </p>
      </div>
      <div className="benchmark">
        <div>
          <span className="bm-label">BENCHMARK BASELINE</span>
          <span className="bm-value">
            {money(baseline.total)} (My Preferences)
          </span>
        </div>
        <div className="bm-delta">
          <TrendingDown size={13} aria-hidden="true" /> Up to{' '}
          {Math.round(bestDelta * 100)}% delta
        </div>
      </div>
    </header>
  )

  if (balanced && balancedResult) {
    return (
      <div className="container draft-page">
        {header}
        <BalancedView
          result={balancedResult}
          anchor={balanced.anchor}
          single={single}
          onQty={setItemQty}
          onUndo={() => {
            setBalanced(null)
            setStrategy(balanced.prevStrategy ?? 'one')
          }}
        />
      </div>
    )
  }

  const selected = results[strategy] ?? results.preferences
  const gaps = strategy === 'one' && res && res.base.missing.length > 0
  let lines = selected.lines
  if (leftOff) lines = lines.filter((l) => l.store)
  if (storeFilter) lines = lines.filter((l) => l.store === storeFilter)
  const leftLines = leftOff ? selected.lines.filter((l) => !l.store) : []
  const applyBalance = (kind) => {
    const stores =
      kind === 'add'
        ? [oneStore, res.addStore.store]
        : [oneStore, ...activeStores.filter((s) => s !== oneStore)]
    setBalanced({ kind, anchor: oneStore, stores, prevStrategy: strategy })
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="container draft-page">
      {header}
      <section className="strategy-section">
        <div className="section-label-row">
          <span>SELECT PROCUREMENT STRATEGY</span>
          {synced && (
            <span className="small">
              Prices from imports up to {usDate(synced)}
            </span>
          )}
        </div>
        <StrategyCards
          results={results}
          selected={strategy}
          onSelect={chooseStrategy}
          oneStore={oneStore}
          onOneStore={(s) => {
            setOneStore(s)
            setLeftOff(false)
          }}
          stores={activeStores}
          pricedCount={pricedCount}
        />
      </section>

      {gaps && !leftOff && (
        <AvailabilityPanel
          anchor={oneStore}
          res={res}
          itemsById={itemsById}
          total={pricedCount}
          noPriceCount={results.cheapest.noPrice.length}
          onAdd={() => applyBalance('add')}
          onAll={() => applyBalance('all')}
          onLeave={() => setLeftOff(true)}
        />
      )}

      {storeFilter && (
        <p className="filter-note">
          Showing only {STORE_META[storeFilter].name} items.{' '}
          <button className="link-btn" onClick={() => setStoreFilter(null)}>
            Show all
          </button>
        </p>
      )}
      <DraftItemsTable
        id="draft-items"
        lines={lines}
        anchor={strategy === 'one' ? oneStore : null}
        sort={sort}
        onSort={setSort}
        onQty={setItemQty}
        count={lines.length}
      />
      {leftLines.length > 0 && (
        <details className="left-off">
          <summary>
            Left off ({leftLines.length}) — they stay marked Low/Out
          </summary>
          <ul>
            {leftLines.map((l) => (
              <li key={l.itemId}>{l.name}</li>
            ))}
          </ul>
        </details>
      )}

      <SummaryBar
        result={leftOff ? { ...selected, missing: [] } : selected}
        total={leftOff ? pricedCount - leftLines.length : pricedCount}
        addStore={gaps ? res.addStore?.store : null}
        onReview={() => {
          setStoreFilter(oneStore)
          document
            .getElementById('draft-items')
            ?.scrollIntoView({ behavior: 'smooth' })
        }}
        onAutoBalance={() => applyBalance('add')}
      />
    </div>
  )
}
