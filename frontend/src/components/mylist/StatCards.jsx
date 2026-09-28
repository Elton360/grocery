import { Archive, Store } from 'lucide-react'

import { STORE_META } from '../../lib/meta.js'

/** Curated items, stores monitored, and Pending Triage (opens the triage drawer). */
export function StatCards({ products, stores, pending, onTriage }) {
  const latest = [...pending].sort((a, b) =>
    (b.last_seen || '').localeCompare(a.last_seen || ''),
  )[0]
  return (
    <div className="stat-cards">
      <div className="stat-card">
        <div className="stat-top">
          <span>Curated items</span>
          <Archive size={16} aria-hidden="true" />
        </div>
        <div className="stat-value">{products}</div>
        <div className="stat-caption">Active master items</div>
      </div>
      <div className="stat-card">
        <div className="stat-top">
          <span>Stores monitored</span>
          <Store size={16} aria-hidden="true" />
        </div>
        <div className="stat-value">
          {stores.length} {stores.length === 1 ? 'Store' : 'Stores'}
        </div>
        <div className="stat-caption">
          {stores.map((s) => STORE_META[s].name).join(', ')}
        </div>
      </div>
      <button className="stat-card triage" onClick={onTriage}>
        <div className="stat-top">
          <span>Pending triage</span>
          <span
            className={`status-circle${pending.length ? ' active' : ''}`}
            aria-hidden="true"
          />
        </div>
        <div className="stat-value">
          {pending.length}
          {latest && (
            <span className="alert-badge">
              {STORE_META[latest.store]?.name ?? latest.store}
            </span>
          )}
        </div>
        <div className="stat-caption">Captured groceries awaiting a home</div>
      </button>
    </div>
  )
}
