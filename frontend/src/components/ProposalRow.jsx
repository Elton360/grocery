import { useState } from 'react'

import { money } from '../../../shared/format.js'
import { Confidence } from './Confidence.jsx'

function Describe({ p, productName }) {
  const pl = p.payload
  if (p.action === 'link') {
    return (
      <>
        <span className="arrow">→</span> {productName(pl.product_id)}
        {pl.match_tier && <span className="small"> ({pl.match_tier})</span>}
      </>
    )
  }
  if (p.action === 'new') {
    return (
      <>
        <span className="arrow">+</span> New product{' '}
        <b>{pl.new_product.name}</b>{' '}
        <span className="small">· {pl.new_product.category}</span>
      </>
    )
  }
  if (p.action === 'pair') {
    return (
      <>
        <span className="arrow">⇄</span> Pair with {pl.pair_with.store}{' '}
        {pl.pair_with.store_product_id} →{' '}
        {pl.new_product ? (
          <>
            new <b>{pl.new_product.name}</b>
          </>
        ) : (
          productName(pl.product_id)
        )}
      </>
    )
  }
  if (p.action === 'ignore') {
    return (
      <>
        <span className="arrow">×</span> Ignore
      </>
    )
  }
  return (
    <>
      <span className="arrow">?</span> Needs you
      {pl.candidates?.length > 0 &&
        ` — candidates: ${pl.candidates.map(productName).join(', ')}`}
    </>
  )
}

function initialForm(p, productById) {
  const pl = p.payload
  const productId = pl.product_id ?? pl.candidates?.[0]
  return {
    action: p.action === 'ask' ? 'link' : p.action,
    product: productById[productId]?.name ?? '',
    newName: pl.new_product?.name ?? '',
    newCategory: pl.new_product?.category ?? '',
    size_text: pl.size_text ?? '',
    match_tier: pl.match_tier ?? '',
    note: pl.note ?? '',
    preferred: Boolean(pl.preferred),
  }
}

/** Edits to send from the editor form; throws a readable error when the form is incomplete. */
function editsFromForm(f, products) {
  const edits = {
    action: f.action,
    size_text: f.size_text || null,
    match_tier: f.match_tier || null,
    note: f.note || null,
    preferred: f.preferred,
  }
  if (f.action === 'link' || f.action === 'pair') {
    const prod = products.find(
      (x) => x.name.toLowerCase() === f.product.trim().toLowerCase(),
    )
    if (!prod && !(f.action === 'pair' && f.newName.trim())) {
      throw new Error('Pick an existing product from the list')
    }
    if (prod) Object.assign(edits, { product_id: prod.id, new_product: null })
  }
  if (f.action === 'new' || (f.action === 'pair' && !edits.product_id)) {
    const name = f.newName.trim()
    if (!name || !f.newCategory)
      throw new Error('New product needs a name and a category')
    edits.new_product = { name, category: f.newCategory }
  }
  return edits
}

/** Converge proposal for a pending item: link / new / pair / ignore / ask, editable before approving. */
export function ProposalRow({
  proposal: p,
  products,
  productById,
  categories,
  onApprove,
  onReject,
}) {
  const [editing, setEditing] = useState(p.action === 'ask')
  const [form, setForm] = useState(() => initialForm(p, productById))
  const set = (field) => (e) =>
    setForm((f) => ({
      ...f,
      [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }))
  const productName = (id) => productById[id]?.name ?? `#${id}`

  /** Returns [edits, createsProduct]. */
  function approval() {
    if (!editing) {
      if (p.action === 'ask')
        throw new Error('Pick an action in the editor first')
      return [
        undefined,
        p.action === 'new' ||
          (p.action === 'pair' && Boolean(p.payload.new_product)),
      ]
    }
    const edits = editsFromForm(form, products)
    return [
      edits,
      edits.action === 'new' ||
        (edits.action === 'pair' && Boolean(edits.new_product)),
    ]
  }

  return (
    <div className="proposal-row">
      <div className="top">
        {p.image_url ? (
          <img src={p.image_url} alt="" loading="lazy" />
        ) : (
          <div className="ph" />
        )}
        <div>
          <div className="item">
            {p.item_url ? (
              <a href={p.item_url} target="_blank" rel="noopener noreferrer">
                {p.item_name}
              </a>
            ) : (
              p.item_name
            )}{' '}
            <span className="small">
              · {p.store} {money(p.last_price)}
              {p.times_seen > 1 && ` · bought ${p.times_seen}×`}
            </span>
          </div>
          <div className="proposal">
            <Describe p={p} productName={productName} />
            <Confidence value={p.confidence} />
          </div>
          {p.reason && <div className="small">{p.reason}</div>}
        </div>
        <div className="btns">
          <button className="ok" onClick={() => onApprove(approval)}>
            Approve
          </button>
          <button onClick={() => setEditing((e) => !e)}>Edit</button>
          <button className="no" onClick={onReject}>
            Reject
          </button>
        </div>
      </div>
      {editing && (
        <div className="edit">
          <label>
            Action
            <select value={form.action} onChange={set('action')}>
              {[
                'link',
                'new',
                'ignore',
                ...(p.action === 'pair' ? ['pair'] : []),
              ].map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <label>
            Product (link / pair)
            <input
              list="product-list"
              value={form.product}
              onChange={set('product')}
              placeholder="Search products…"
            />
          </label>
          <label>
            New product name
            <input value={form.newName} onChange={set('newName')} />
          </label>
          <label>
            Category
            <select value={form.newCategory} onChange={set('newCategory')}>
              <option value="" />
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Size for price math
            <input
              value={form.size_text}
              onChange={set('size_text')}
              placeholder="e.g. 5.3 oz, 6-count"
            />
          </label>
          <label>
            Match
            <select value={form.match_tier} onChange={set('match_tier')}>
              {['', 'exact', 'equivalent', 'substitute'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Note
            <input value={form.note} onChange={set('note')} />
          </label>
          <label className="chk">
            <input
              type="checkbox"
              checked={form.preferred}
              onChange={set('preferred')}
            />{' '}
            Show first for its store
          </label>
        </div>
      )}
    </div>
  )
}
