import { useState } from 'react'

import { money } from '../../../shared/format.js'
import { Confidence } from './Confidence.jsx'

const STORE_LABEL = { costco: 'Costco', aldi: 'Aldi', walmart: 'Walmart' }

function Option({ c, tier }) {
  return (
    <>
      {c.url ? (
        <a href={c.url} target="_blank" rel="noopener noreferrer">
          {c.name}
        </a>
      ) : (
        c.name
      )}{' '}
      <span className="small">
        · {money(c.price)}
        {c.size_text && ` · ${c.size_text}`}
        {tier && ` (${tier})`}
      </span>
    </>
  )
}

/** Edits sent on approve for the picked option (undefined = approve the proposal as is). */
function editsFor(action, pick) {
  if (action === 'not_carried' || pick === 'main') return undefined
  if (pick === null) throw new Error('Pick one of the options first')
  if (pick === 'nc') return { action: 'not_carried' }
  return { action: 'version', choice: Number(pick.split('-')[1]) }
}

/** Normalize proposal: a store version for a product (main find, alternatives) or "not carried". */
export function NormalizeRow({ proposal: p, onApprove, onReject }) {
  const pl = p.payload
  const where = STORE_LABEL[pl.target] || pl.target
  const [pick, setPick] = useState(p.action === 'version' ? 'main' : null)

  const options = []
  if (p.action === 'version') {
    options.push(['main', <Option c={pl} tier={pl.match_tier} key="main" />])
    ;(pl.alternatives || []).forEach((a, i) =>
      options.push([`alt-${i}`, <Option c={a} key={i} />]),
    )
  } else if (p.action === 'version_ask') {
    ;(pl.candidates || []).forEach((c, i) =>
      options.push([`alt-${i}`, <Option c={c} key={i} />]),
    )
  }
  if (p.action !== 'not_carried')
    options.push(['nc', `Not carried at ${where}`])

  return (
    <div className="proposal-row">
      <div className="top">
        <div className="ph" />
        <div>
          <div className="item">
            <b>{pl.product_name}</b> <span className="small">at {where}</span>
            <Confidence value={p.confidence} />
          </div>
          {p.action === 'not_carried' ? (
            <div className="proposal">
              <span className="arrow">×</span> Not carried at {where}
              {pl.note && `: ${pl.note}`}
            </div>
          ) : (
            options.map(([value, label]) => (
              <label className="opt" key={value}>
                <input
                  type="radio"
                  name={`pick-${p.id}`}
                  checked={pick === value}
                  onChange={() => setPick(value)}
                />{' '}
                {label}
              </label>
            ))
          )}
          {pl.note && p.action !== 'not_carried' && (
            <div className="small">{pl.note}</div>
          )}
          {p.reason && <div className="small">{p.reason}</div>}
        </div>
        <div className="btns">
          <button
            className="ok"
            onClick={() => onApprove(() => [editsFor(p.action, pick), false])}
          >
            Approve
          </button>
          <button className="no" onClick={onReject}>
            Reject
          </button>
        </div>
      </div>
    </div>
  )
}
