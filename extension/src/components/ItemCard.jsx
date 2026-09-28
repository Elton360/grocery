import { Package, Undo2, X } from 'lucide-react'

import { STORE_NAMES, money } from '../../../shared/format.js'
import { CandidateRow } from './CandidateRow.jsx'

/** "Store · size · 2 units · notes", skipping missing parts. */
function metaLine(f) {
  const it = f.item
  return [
    STORE_NAMES[f.store],
    it.size_text,
    it.qty > 1 && `${it.qty} units`,
    it.notes,
  ]
    .filter(Boolean)
    .join(' · ')
}

/**
 * One captured item. On the New tab it's selectable (card click or checkbox) with an Omit action;
 * on Omitted it offers "Add to My List"; Tracked is read-only.
 */
export function ItemCard({
  f,
  selectable,
  selected,
  onToggle,
  onOmit,
  onRestore,
  busy,
}) {
  const id = `item-${f.key}`
  const toggle = selectable ? onToggle : undefined
  return (
    <article
      className={`item-card${selected ? ' selected' : ''}${selectable ? ' selectable' : ''}`}
      onClick={toggle}
    >
      <div className="item-row">
        {selectable && (
          <input
            id={id}
            type="checkbox"
            checked={selected}
            onChange={toggle}
            onClick={(e) => e.stopPropagation()}
          />
        )}
        {f.item.image_url ? (
          <img className="thumb" src={f.item.image_url} alt="" />
        ) : (
          <span className="thumb fallback" aria-hidden="true">
            <Package size={28} />
          </span>
        )}
        <div className="item-text">
          <label
            htmlFor={selectable ? id : undefined}
            className="item-title"
            title={f.item.name}
          >
            {f.item.name}
          </label>
          <span className="item-meta">{metaLine(f)}</span>
        </div>
        <span className="item-price">{money(f.item.price_each)}</span>
      </div>
      {selectable && <CandidateRow />}
      {(onOmit || onRestore) && (
        <div className="card-actions">
          {onOmit && (
            <button
              className="text-btn muted"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation()
                onOmit()
              }}
            >
              <X size={14} aria-hidden="true" /> Omit (skip in future imports)
            </button>
          )}
          {onRestore && (
            <button className="text-btn" disabled={busy} onClick={onRestore}>
              <Undo2 size={14} aria-hidden="true" /> Add to My List
            </button>
          )}
        </div>
      )}
    </article>
  )
}
