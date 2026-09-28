import { useMemo, useState } from 'react'

import { api } from '../api.js'
import { StoreCell } from '../components/StoreCell.jsx'
import { useLoad } from '../hooks/useLoad.js'
import { STORES, headline, winnerOf } from '../lib/prices.js'

const COLUMNS = [
  ['name', 'Product'],
  ['category', 'Category'],
  ['costco', 'Costco'],
  ['walmart', 'Walmart'],
  ['aldi', 'Aldi'],
]

function sortValue(p, key) {
  if (key === 'name') return p.name
  if (key === 'category') return `${p.category || ''}|${p.name}`
  const h = headline(p, key)
  return h && h.ppu !== '' ? Number(h.ppu) : Infinity
}

export function ComparePage() {
  const { data, error } = useLoad(() => api.compare(), [])
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [onlyMulti, setOnlyMulti] = useState(false)
  const [sort, setSort] = useState({ key: 'category', dir: 1 })

  const categories = useMemo(
    () =>
      data ? [...new Set(data.products.map((p) => p.category))].sort() : [],
    [data],
  )
  const rows = useMemo(() => {
    if (!data) return []
    const needle = q.trim().toLowerCase()
    return data.products
      .filter(
        (p) =>
          (!cat || p.category === cat) &&
          (!onlyMulti ||
            STORES.filter((s) => p.stores[s].versions.length).length > 1) &&
          (!needle ||
            [
              p.name,
              ...STORES.flatMap((s) => p.stores[s].versions.map((v) => v.name)),
            ]
              .join(' ')
              .toLowerCase()
              .includes(needle)),
      )
      .sort((a, b) => {
        const x = sortValue(a, sort.key)
        const y = sortValue(b, sort.key)
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir
      })
  }, [data, q, cat, onlyMulti, sort])

  const sortBy = (key) =>
    setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }))

  return (
    <>
      <h1>Grocery price compare</h1>
      <p className="sub">
        Your curated grocery list, compared per unit across stores. Each store
        shows its best version; open “more versions” for other sizes and brands.
      </p>
      {data && (
        <div className="stats">
          <div className="stat">
            <b>×{data.markup.toFixed(2)}</b>
            <span>Instacart markup over Costco</span>
          </div>
        </div>
      )}
      <div className="controls">
        <input
          type="search"
          placeholder="Search products or versions…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <label className="chk">
          <input
            type="checkbox"
            checked={onlyMulti}
            onChange={(e) => setOnlyMulti(e.target.checked)}
          />{' '}
          Only items at 2+ stores
        </label>
      </div>
      <div className="table-wrap">
        <table className="compare">
          <thead>
            <tr>
              {COLUMNS.map(([key, label]) => (
                <th
                  key={key}
                  className={STORES.includes(key) ? `s-${key}` : ''}
                  onClick={() => sortBy(key)}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr>
                <td colSpan={5} className="err">
                  {error.message}
                </td>
              </tr>
            )}
            {!data && !error && (
              <tr>
                <td colSpan={5} className="cat">
                  Loading…
                </td>
              </tr>
            )}
            {data && !rows.length && (
              <tr>
                <td colSpan={5} className="cat">
                  No products match.
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const winner = winnerOf(p)
              return (
                <tr key={p.id}>
                  <td className="prod">
                    <b>{p.name}</b>
                  </td>
                  <td className="cat">{p.category}</td>
                  {STORES.map((s) => (
                    <StoreCell
                      key={s}
                      product={p}
                      store={s}
                      winner={winner}
                      markup={data.markup}
                    />
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
