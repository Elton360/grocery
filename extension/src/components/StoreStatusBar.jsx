import { RefreshCw } from 'lucide-react'

import { STORE_NAMES } from '../../../shared/format.js'

const SOURCE = { order: 'order', cart: 'cart', receipt: 'receipt' }

/**
 * Latest import (store, kind, date), Refresh (re-grab it from the active tab; disabled off the relevant page,
 * the tooltip says what it does), and "Offline" when the backend doesn't answer.
 */
export function StoreStatusBar({ captures, live, refresh }) {
  const list = Object.values(captures).sort((a, b) =>
    b.captured_at.localeCompare(a.captured_at),
  )
  const latest = list[0]
  const text = latest
    ? `${STORE_NAMES[latest.store]} ${SOURCE[latest.source]}${latest.order_date ? ` · ${latest.order_date}` : ''}${
        list.length > 1
          ? ` — +${list.length - 1} more import${list.length > 2 ? 's' : ''}`
          : ' — Active'
      }`
    : 'Nothing imported yet'
  return (
    <div className="status-bar">
      <span className="store-chip" title={text}>
        <span className="dot" aria-hidden="true" />
        <span className="truncate">{text}</span>
      </span>
      <span className="status-actions">
        {live === false && <span className="offline">Offline</span>}
        <button
          className="icon-btn refresh"
          title={refresh.label}
          aria-label={refresh.label}
          disabled={!refresh.enabled || refresh.busy}
          onClick={refresh.run}
        >
          <RefreshCw
            size={18}
            aria-hidden="true"
            className={refresh.busy ? 'spin' : ''}
          />
        </button>
      </span>
    </div>
  )
}
