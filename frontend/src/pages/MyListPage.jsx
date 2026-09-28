import { useState } from 'react'

import { api } from '../api.js'
import { CompareTable } from '../components/CompareTable.jsx'
import { IgnoredSection } from '../components/IgnoredSection.jsx'
import { PendingSection } from '../components/PendingSection.jsx'
import { useLoad } from '../hooks/useLoad.js'

/** My List: pending items from the side panel, the curated list compared across stores, ignored items. */
export function MyListPage() {
  const compare = useLoad(() => api.compare(), [])
  const pending = useLoad(() => api.items('pending'), [])
  const ignored = useLoad(() => api.items('ignored'), [])
  const [busy, setBusy] = useState(null)

  async function move(item, action) {
    setBusy(`${item.store}/${item.store_product_id}`)
    try {
      await api.setItemStatus(item.store, item.store_product_id, action)
      await Promise.all([pending.reload(), ignored.reload()])
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>My List</h1>
          <p className="sub">
            Your groceries compared per unit across stores. Each store shows its
            best version; open “more versions” for other sizes and brands.
          </p>
        </div>
        {compare.data && (
          <div className="stat">
            <b>×{compare.data.markup.toFixed(2)}</b>
            <span>Instacart markup over Costco</span>
          </div>
        )}
      </div>
      {pending.error && <p className="err">{pending.error.message}</p>}
      {pending.data && (
        <PendingSection
          items={pending.data.items}
          busyKey={busy}
          onRemove={(i) => move(i, 'remove')}
          onConverged={pending.reload}
        />
      )}
      <CompareTable data={compare.data} error={compare.error} />
      {ignored.data && (
        <IgnoredSection
          items={ignored.data.items}
          busyKey={busy}
          onRestore={(i) => move(i, 'restore')}
        />
      )}
    </>
  )
}
