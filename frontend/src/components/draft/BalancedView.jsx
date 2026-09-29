import { Archive, CircleCheck, Leaf, Scale, ShoppingCart } from 'lucide-react'
import { useState } from 'react'

import { money } from '../../../../shared/format.js'
import { Link } from '../Link.jsx'
import { STORE_META, categoryMeta } from '../../lib/meta.js'
import { bannerText, metaFor, tagsFor } from './balance.js'
import { QtyStepper } from './QtyStepper.jsx'
import { StartShopping } from './StartShopping.jsx'
import { StatusPill } from './StatusPill.jsx'

function StoreGroup({ store, stop, lines, anchor, checked, onCheck, onQty }) {
  const done = lines.filter((l) => checked.has(l.itemId)).length
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0)
  const ordered = [...lines].sort(
    (a, b) => checked.has(a.itemId) - checked.has(b.itemId),
  )
  const id = `store-${store}`
  return (
    <section className="store-group" aria-labelledby={id}>
      <header className="store-head">
        <span
          className="store-avatar"
          style={{ background: STORE_META[store].avatar }}
          aria-hidden="true"
        >
          {STORE_META[store].name[0]}
        </span>
        <span className="store-title">
          <span id={id}>{STORE_META[store].name}</span>
          <small>
            {lines.length} {lines.length === 1 ? 'item' : 'items'} • Subtotal{' '}
            {money(subtotal)}
            {done > 0 && ` • ${done}/${lines.length} done`}
          </small>
        </span>
        <span className="stop-chip">Stop {stop}</span>
      </header>
      <div className="trip-rows">
        {ordered.map((l) => {
          const isChecked = checked.has(l.itemId)
          return (
            <div
              key={l.itemId}
              className={`trip-row${isChecked ? ' checked' : ''}${l.moved || l.reason === 'gap' ? ' flash' : ''}`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onCheck(l.itemId)}
                aria-label={`Got ${l.name}`}
              />
              <div className="trip-text">
                <div className="trip-name">
                  {l.name}
                  <StatusPill status={l.status} variant="soft" />
                  {tagsFor(l, anchor).map((t) => (
                    <span
                      key={t.text}
                      className={`reason-tag ${t.kind}`}
                      title={t.title}
                    >
                      {t.text}
                    </span>
                  ))}
                </div>
                <div className="trip-meta">
                  {metaFor(l, categoryMeta(l.category).name)}
                </div>
              </div>
              <QtyStepper
                name={l.name}
                qty={l.qty}
                onChange={(q) => onQty(l.itemId, q)}
                className="soft"
              />
              <span className="trip-price">
                {money(l.lineTotal)}
                <small>{money(l.unitPrice)} ea</small>
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function SavingsCard({ result, single }) {
  if (!single || single.result.total - result.total <= 0) return null
  const saved = single.result.total - result.total
  const width = `${Math.round((result.total / single.result.total) * 100)}%`
  return (
    <div className="savings-card">
      <div className="sv-top">
        <span>STRATEGY SAVINGS</span>
        <span className="sv-badge">Optimal</span>
      </div>
      <div className="sv-value">
        {money(saved)} <small>net saved today</small>
      </div>
      <div className="sv-bar-label">
        <span>Single store ({STORE_META[single.store].name})</span>
        <span>{money(single.result.total)}</span>
      </div>
      <div
        className="sv-bar"
        role="img"
        aria-label={`Single store ${money(single.result.total)}`}
      >
        <span style={{ width: '100%' }} className="gray" />
      </div>
      <div className="sv-bar-label">
        <span>Auto-Balanced Run</span>
        <span>{money(result.total)}</span>
      </div>
      <div
        className="sv-bar"
        role="img"
        aria-label={`Auto-balanced ${money(result.total)}`}
      >
        <span style={{ width }} />
      </div>
      <div className="sv-foot">
        <Leaf size={11} aria-hidden="true" /> Compared with the cheapest single
        store that has everything
      </div>
    </div>
  )
}

/** After auto-balancing: the trip plan per store, savings, and the total bar. */
export function BalancedView({ result, anchor, single, onQty, onUndo }) {
  const [checked, setChecked] = useState(() => new Set())
  const toggle = (id) =>
    setChecked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const banner = bannerText(result, anchor)
  const assigned = result.lines.filter((l) => l.store)
  const outCount = assigned.filter((l) => l.status === 'out').length
  const units = assigned.reduce((s, l) => s + l.qty, 0)
  const optimal = single && single.result.total > result.total

  return (
    <>
      <div className="status-row">
        <span className="strategy-chip">
          <Scale size={12} aria-hidden="true" /> Active Strategy: Auto-Balanced
          ({result.stores.map((s) => STORE_META[s].name).join(' + ')}) •{' '}
          {result.stores.length} Stores • {money(result.total)} Total
        </span>
        <span className="opt-indicator">
          {optimal ? 'CHEAPER THAN ANY SINGLE STORE' : 'ALL ITEMS COVERED'}{' '}
          <span className="dot" />
        </span>
      </div>
      <div className="balanced-banner">
        <span className="bb-icon" aria-hidden="true">
          <CircleCheck size={16} />
        </span>
        <p>
          {banner.lead}
          <b>{banner.stores}</b>. {banner.moved}
        </p>
        <button className="link-btn" onClick={onUndo}>
          Undo balancing
        </button>
      </div>
      <div className="balanced-layout">
        <div className="store-groups">
          {result.stores.map((s, i) => (
            <StoreGroup
              key={s}
              store={s}
              stop={i + 1}
              anchor={anchor}
              lines={assigned.filter((l) => l.store === s)}
              checked={checked}
              onCheck={toggle}
              onQty={onQty}
            />
          ))}
        </div>
        <aside className="balanced-side">
          <SavingsCard result={result} single={single} />
          {outCount > 0 && (
            <Link to="/my-list?filter=lowout" className="pantry-card">
              <span className="pc-icon" aria-hidden="true">
                <Archive size={14} />
              </span>
              <span>
                <b>Pantry Auto-Depletion Sync</b>
                <small>
                  {outCount} urgent {outCount === 1 ? 'item' : 'items'}{' '}
                  replenishment staged.
                </small>
              </span>
            </Link>
          )}
        </aside>
      </div>
      <div className="total-bar">
        <div>
          <span className="tb-total">{money(result.total)}</span>{' '}
          <small>total</small>
          <div className="small">
            {result.stores.length} stores ({assigned.length} items, {units}{' '}
            units total)
          </div>
        </div>
        <div className="tb-actions">
          <button
            className="btn-soft"
            onClick={() => {
              document
                .querySelector('.trip-row .qty-stepper button:last-child')
                ?.focus()
              document.body.classList.add('highlight-steppers')
              setTimeout(
                () => document.body.classList.remove('highlight-steppers'),
                1200,
              )
            }}
          >
            Adjust Quantities
          </button>
          <StartShopping>
            <ShoppingCart size={14} aria-hidden="true" /> Start Shopping
          </StartShopping>
        </div>
      </div>
    </>
  )
}
