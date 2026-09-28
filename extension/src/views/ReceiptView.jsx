import { useState } from 'react'

import { plural, today } from '../../../shared/format.js'
import { parseReceipt } from '../../../shared/receipt.js'

/** Costco receipt paste: parsed lines are imported into the feed like any other capture. */
export function ReceiptView({ busy, onImport, onCancel }) {
  const [text, setText] = useState('')
  const [date, setDate] = useState(today())
  const { items, bad } = parseReceipt(text)
  return (
    <div className="main-view">
      <section className="panel-card">
        <h2>Paste Costco receipt</h2>
        <label className="field">
          Receipt date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className="field">
          Receipt lines, e.g. <code>E 123456 KS EGGS 2DZ 5.29 N</code> (add{' '}
          <code>//note</code> to keep a comment)
          <textarea
            spellCheck={false}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <p className={`small${bad.length ? ' err' : ''}`}>
          {plural(items.length, 'line')} read
          {bad.length > 0 &&
            ` · could not read ${plural(bad.length, 'line')}: ${bad.join(' | ')}`}
        </p>
        <button
          className="add-btn"
          disabled={!items.length || !date || busy}
          onClick={() =>
            onImport({
              store: 'costco',
              source: 'receipt',
              order_date: date,
              price_mode: 'in_store',
              items,
            })
          }
        >
          Import {plural(items.length, 'item')}
        </button>
        <button className="text-btn" onClick={onCancel}>
          Cancel
        </button>
      </section>
    </div>
  )
}
