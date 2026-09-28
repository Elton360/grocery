import { useMemo, useState } from 'react'

import { plural } from '../../../shared/format.js'
import { api } from '../api.js'
import { NormalizeRow } from '../components/NormalizeRow.jsx'
import { ProposalRow } from '../components/ProposalRow.jsx'
import { useLoad } from '../hooks/useLoad.js'
import { Link } from '../components/Link.jsx'

const GROUPS = [
  ['pair', 'Costco receipt ↔ Instacart pairs'],
  ['link', 'Link to an existing product'],
  ['new', 'New products'],
  ['ask', 'Needs you'],
  ['ignore', 'Ignore (one-offs)'],
  ['version', 'New store versions (normalize)'],
  ['version_ask', 'Needs you — store versions'],
  ['not_carried', 'Not carried'],
]
const NORMALIZE = new Set(['version', 'not_carried', 'version_ask'])

export function ReviewPage() {
  const { data, error, reload, setData } = useLoad(
    () => api.proposals('proposed'),
    [],
  )
  const [msg, setMsg] = useState(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const productById = useMemo(
    () => Object.fromEntries((data?.products ?? []).map((p) => [p.id, p])),
    [data],
  )

  const drop = (id) =>
    setData((d) => ({
      ...d,
      proposals: d.proposals.filter((x) => x.id !== id),
    }))

  /** approval() returns [edits, createsProduct] and throws a readable error when the row isn't ready. */
  async function approve(p, approval) {
    try {
      const [edits, createsProduct] = approval()
      await api.approve(p.id, edits)
      setMsg(null)
      if (createsProduct)
        await reload() // a new product must appear in the link dropdowns
      else drop(p.id)
    } catch (e) {
      setMsg({ error: true, text: e.message })
    }
  }

  async function reject(p) {
    try {
      await api.reject(p.id)
      drop(p.id)
    } catch (e) {
      setMsg({ error: true, text: e.message })
    }
  }

  async function bulk() {
    setBulkBusy(true)
    try {
      const res = await api.approveBulk(0.9)
      await reload()
      setMsg({
        text: `Approved ${plural(res.approved, 'high-confidence proposal')}${
          res.errors.length
            ? ` · ${res.errors.length} could not be applied`
            : ''
        }.`,
      })
    } catch (e) {
      setMsg({ error: true, text: e.message })
    }
    setBulkBusy(false)
  }

  const n = data?.proposals.length ?? 0
  return (
    <>
      <h1>Review proposals</h1>
      <p className="sub">
        AI proposals: pending items to join your list (converge) and missing
        store versions (normalize). Nothing joins your grocery list until you
        approve it; rejected items stay pending.
      </p>
      <div className="bar">
        <button className="primary" onClick={bulk} disabled={bulkBusy || !n}>
          Approve all ≥ 90% confidence
        </button>
        <span className={`grow${msg?.error ? ' err' : ''}`}>
          {msg?.text ?? (n ? `${plural(n, 'proposal')} waiting.` : '')}
        </span>
      </div>
      <datalist id="product-list">
        {(data?.products ?? []).map((p) => (
          <option key={p.id} value={p.name} />
        ))}
      </datalist>
      {error && <div className="empty err">{error.message}</div>}
      {!data && !error && <div className="empty">Loading…</div>}
      {data && !n && (
        <div className="empty">
          No proposals waiting. Run Converge from the Pending section of{' '}
          <Link to="/my-list">My List</Link>.
        </div>
      )}
      {data &&
        GROUPS.map(([action, title]) => {
          const rows = data.proposals.filter((p) => p.action === action)
          if (!rows.length) return null
          return (
            <section className="card" key={action}>
              <h2>
                {title} <span className="small">· {rows.length}</span>
              </h2>
              {rows.map((p) =>
                NORMALIZE.has(p.action) ? (
                  <NormalizeRow
                    key={p.id}
                    proposal={p}
                    onApprove={(approval) => approve(p, approval)}
                    onReject={() => reject(p)}
                  />
                ) : (
                  <ProposalRow
                    key={p.id}
                    proposal={p}
                    products={data.products}
                    productById={productById}
                    categories={data.categories}
                    onApprove={(approval) => approve(p, approval)}
                    onReject={() => reject(p)}
                  />
                ),
              )}
            </section>
          )
        })}
    </>
  )
}
