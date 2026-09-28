import { useMemo, useState } from 'react'

import { plural } from '../../../shared/format.js'
import { api } from '../api.js'
import { ConvergeBar } from '../components/ConvergeBar.jsx'
import { ItemRow } from '../components/ItemRow.jsx'
import { useLoad } from '../hooks/useLoad.js'

const TABS = [
  ['pending', 'Pending'],
  ['converged', 'On list'],
  ['ignored', 'Ignored'],
]
const HELP = {
  pending:
    'Gathered but not yet on your grocery list. Remove anything you no longer buy — removed items won’t come back on later grabs.',
  converged:
    'Your curated grocery list, grouped by product. Grabs skip these automatically.',
  ignored: 'Removed items. Future grabs skip them; restore to bring one back.',
}

export function ListPage() {
  const [status, setStatus] = useState('pending')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(null)
  const { data, error, reload, setData } = useLoad(
    () => api.items(status),
    [status],
  )

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const shown = (data?.items ?? []).filter(
      (i) =>
        !needle ||
        [i.name, i.product_name, i.store_product_id]
          .join(' ')
          .toLowerCase()
          .includes(needle),
    )
    const out = {}
    for (const i of shown) {
      const g =
        status === 'converged' ? i.product_name || 'Unassigned' : i.store
      ;(out[g] ||= []).push(i)
    }
    return {
      count: shown.length,
      entries: Object.entries(out).sort(([a], [b]) => a.localeCompare(b)),
    }
  }, [data, q, status])

  async function act(item) {
    const key = `${item.store}/${item.store_product_id}`
    setBusy(key)
    try {
      await api.setItemStatus(
        item.store,
        item.store_product_id,
        status === 'ignored' ? 'restore' : 'remove',
      )
      setData((d) => ({ ...d, items: d.items.filter((i) => i !== item) }))
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <h1>Gathered items</h1>
      <p className="sub">
        {error ? (
          <span className="err">{error.message}</span>
        ) : data ? (
          `${plural(groups.count, 'item')} — ${HELP[status]}`
        ) : (
          'Loading…'
        )}
      </p>
      <div className="bar">
        <div className="tabs" role="tablist">
          {TABS.map(([s, label]) => (
            <button
              key={s}
              role="tab"
              aria-selected={s === status}
              onClick={() => setStatus(s)}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search items…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <ConvergeBar onFinished={status === 'pending' ? reload : undefined} />
      </div>
      {data && !groups.entries.length && (
        <div className="empty">Nothing here.</div>
      )}
      {groups.entries.map(([g, items]) => (
        <section className="card" key={g}>
          <h2 className={status === 'converged' ? '' : `store s-${g}`}>
            {g}
            {status === 'converged' && items[0].category && (
              <span className="small"> · {items[0].category}</span>
            )}
            <span className="small"> · {items.length}</span>
          </h2>
          {items.map((i) => (
            <ItemRow
              key={`${i.store}/${i.store_product_id}`}
              item={i}
              status={status}
              busy={busy === `${i.store}/${i.store_product_id}`}
              onAction={() => act(i)}
            />
          ))}
        </section>
      ))}
    </>
  )
}
