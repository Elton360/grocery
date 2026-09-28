import { SlidersHorizontal } from 'lucide-react'
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react'

import { STORES } from '../../../shared/prices.js'
import { computeRecommendation } from '../../../shared/recommend.js'
import { api } from '../api.js'
import { CategoryGroup } from '../components/mylist/CategoryGroup.jsx'
import { SearchAndFilters } from '../components/mylist/SearchAndFilters.jsx'
import { StatCards } from '../components/mylist/StatCards.jsx'
import { TriageDrawer } from '../components/mylist/TriageDrawer.jsx'
import { useLoad } from '../hooks/useLoad.js'
import { STORE_META, categoryMeta } from '../lib/meta.js'

const GROUP_BY = [
  ['category', 'Category'],
  ['store', 'Best store'],
  ['none', 'None'],
]

/** Debounced copy of a value (search input). */
function useDebounced(value, ms) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

function matches(p, needle) {
  if (!needle) return true
  const hay = [
    p.name,
    ...STORES.flatMap((s) =>
      p.stores[s].versions.length
        ? [
            STORE_META[s].name,
            ...p.stores[s].versions.flatMap((v) => [
              v.name,
              v.store_product_id,
            ]),
          ]
        : [],
    ),
  ]
  return hay.join(' ').toLowerCase().includes(needle)
}

/** My Grocery List: curated master items with their store variants and the best store to buy each. */
export function MyListPage() {
  const compare = useLoad(() => api.compare(), [])
  const pending = useLoad(() => api.items('pending'), [])
  const ignored = useLoad(() => api.items('ignored'), [])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [groupBy, setGroupBy] = useState('category')
  const [expandedId, setExpandedId] = useState(null)
  const [triageOpen, setTriageOpen] = useState(false)
  const [busy, setBusy] = useState(null)
  const needle = useDeferredValue(useDebounced(query, 200).trim().toLowerCase())

  const products = useMemo(() => compare.data?.products ?? [], [compare.data])
  const recs = useMemo(
    () => new Map(products.map((p) => [p.id, computeRecommendation(p)])),
    [products],
  )
  const stores = useMemo(
    () =>
      STORES.filter((s) => products.some((p) => p.stores[s].versions.length)),
    [products],
  )
  const categories = useMemo(() => {
    const counts = new Map()
    for (const p of products)
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1)
    return [...counts].sort(([a], [b]) =>
      categoryMeta(a).name.localeCompare(categoryMeta(b).name),
    )
  }, [products])

  const groups = useMemo(() => {
    const shown = products.filter(
      (p) => (!category || p.category === category) && matches(p, needle),
    )
    const byName = (a, b) => a.name.localeCompare(b.name)
    if (groupBy === 'none')
      return shown.length ? [{ id: 'all', items: [...shown].sort(byName) }] : []
    const out = new Map()
    for (const p of shown) {
      const id =
        groupBy === 'store' ? (recs.get(p.id)?.store ?? 'none') : p.category
      if (!out.has(id)) out.set(id, [])
      out.get(id).push(p)
    }
    return [...out]
      .map(([id, items]) => ({
        id,
        title:
          groupBy === 'store'
            ? (STORE_META[id]?.name ?? 'No current price')
            : categoryMeta(id).name,
        icon: groupBy === 'store' ? SlidersHorizontal : undefined,
        aside:
          groupBy === 'store' ? 'Cheapest store for these items' : undefined,
        items: items.sort(byName),
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [products, category, needle, groupBy, recs])

  const toggle = useCallback(
    (id) => setExpandedId((cur) => (cur === id ? null : id)),
    [],
  )
  const closeTriage = useCallback(() => setTriageOpen(false), [])

  async function move(item, action) {
    setBusy(`${item.store}/${item.store_product_id}`)
    try {
      await api.setItemStatus(item.store, item.store_product_id, action)
      await Promise.all([pending.reload(), ignored.reload()])
    } finally {
      setBusy(null)
    }
  }

  const error = compare.error ?? pending.error
  return (
    <>
      <div className="band">
        <div className="container">
          <header className="page-header">
            <div>
              <h1>My Grocery List</h1>
              <p className="subtitle">
                Reconcile captured online carts and cross-store pricing across{' '}
                <b>multiple stores</b>.
              </p>
            </div>
          </header>
          {error && <p className="err">{error.message}</p>}
          <StatCards
            products={products.length}
            stores={stores}
            pending={pending.data?.items ?? []}
            onTriage={() => setTriageOpen(true)}
          />
          <SearchAndFilters
            query={query}
            onQuery={setQuery}
            categories={categories}
            category={category}
            onCategory={setCategory}
            total={products.length}
          />
        </div>
      </div>

      <div className="container curated">
        <div className="section-header">
          <div>
            <h2>
              <span className="dot" aria-hidden="true" />
              Curated Source of Truth
              <span className="verified">Verified Staples</span>
            </h2>
            <p className="subtitle">
              Cross-store tracked master groceries. Click an item to expand all
              of its store variants.
            </p>
          </div>
          <label className="group-by">
            <SlidersHorizontal size={14} aria-hidden="true" />
            Group by:
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
            >
              {GROUP_BY.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!compare.data && !compare.error && <p className="empty">Loading…</p>}
        {compare.data && !products.length && (
          <div className="empty">
            Nothing on your list yet. Open the Grocery Grabber side panel
            (toolbar icon) on a store page and import your orders or carts.
          </div>
        )}
        {compare.data && products.length > 0 && !groups.length && (
          <div className="empty">
            No groceries match “{query}”.{' '}
            <button
              className="link-btn"
              onClick={() => {
                setQuery('')
                setCategory('')
              }}
            >
              Clear
            </button>
          </div>
        )}
        {groups.map((g) => (
          <CategoryGroup
            key={g.id}
            group={g}
            recs={recs}
            expandedId={expandedId}
            onToggle={toggle}
          />
        ))}
      </div>

      <TriageDrawer
        open={triageOpen}
        onClose={closeTriage}
        pending={pending.data?.items ?? []}
        ignored={ignored.data?.items ?? []}
        busyKey={busy}
        onRemove={(i) => move(i, 'remove')}
        onRestore={(i) => move(i, 'restore')}
        onConverged={pending.reload}
      />
    </>
  )
}
