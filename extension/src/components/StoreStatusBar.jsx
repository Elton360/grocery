import { RefreshCw } from 'lucide-react'

import { STORE_NAMES } from '../../../shared/format.js'

const SOURCE = { order: 'order', cart: 'cart', receipt: 'receipt' }

/** Latest import (store, kind, date) and whether the backend is reachable. */
export function StoreStatusBar({ captures, live }) {
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
      <span className={`live${live ? '' : ' paused'}`}>
        <RefreshCw size={16} aria-hidden="true" />
        {live === false ? 'Paused' : 'Live'}
      </span>
    </div>
  )
}
