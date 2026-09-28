/**
 * Converge: pending items → proposals (from an AI agent) → approved links/products.
 *
 * The agent never writes to the DB directly. It reads an export, writes a proposals JSON, and `apply`
 * validates and stores proposals; a human approves them on the review page.
 */
import fs from 'node:fs'
import path from 'node:path'

import { DATA, ROOT } from '../paths.js'

import * as compare from './compare.js'
import * as normalize from './normalize.js'
import { RULES } from './rules.js'
import { ValueError, batchId, now, repr, toFloat } from './util.js'

export const BATCH_DIR = path.join(DATA, 'converge')
const ACTIONS = new Set(['link', 'new', 'pair', 'ignore', 'ask'])
const TIERS = new Set(['exact', 'equivalent', 'substitute'])
export const CATEGORIES = [
  'dairy',
  'produce',
  'meat/seafood',
  'bakery',
  'snacks',
  'pantry',
  'frozen',
  'household',
  'other',
]

// ---------- export ----------

export function exportBatch(db) {
  const pending = db
    .prepare(
      `SELECT i.store, i.store_product_id, i.name, i.url, i.last_price, i.times_seen, i.first_seen, i.last_seen
       FROM items i WHERE i.status = 'pending' ORDER BY i.store, i.name COLLATE NOCASE`,
    )
    .all()
  const latest = new Map()
  for (const r of db
    .prepare(
      `SELECT o.store, o.store_product_id, o.unit_price_text, o.notes FROM observations o
       JOIN grabs g ON g.id = o.grab_id ORDER BY g.order_date, g.id, o.id`,
    )
    .all()) {
    latest.set(`${r.store}\u0000${r.store_product_id}`, r)
  }
  for (const p of pending) {
    const o = latest.get(`${p.store}\u0000${p.store_product_id}`)
    p.unit_price_text = o ? o.unit_price_text : null
    p.notes = o ? o.notes : null
  }

  const versionsOf = db.prepare(
    "SELECT * FROM items WHERE product_id=? AND status='converged' ORDER BY rowid",
  )
  const products = db
    .prepare('SELECT id, name, category FROM products ORDER BY category, name')
    .all()
    .map((pr) => ({
      ...pr,
      versions: versionsOf.all(pr.id).map((r) => ({
        store: r.store,
        id: r.store_product_id,
        name: r.name,
        size_text: r.size_text,
        price: r.last_price,
        pair_id: r.pair_id,
      })),
    }))

  const unpairedCostco = db
    .prepare(
      `SELECT * FROM items c WHERE c.store='costco' AND c.status='converged'
       AND c.store_product_id NOT LIKE 'name:%'
       AND NOT EXISTS (SELECT 1 FROM items i WHERE i.store='instacart' AND i.pair_id=c.store_product_id)
       ORDER BY c.store_product_id`,
    )
    .all()
    .map((r) => ({
      id: r.store_product_id,
      name: r.name,
      product_id: r.product_id,
    }))
  const unpairedInstacart = db
    .prepare(
      `SELECT * FROM items WHERE store='instacart' AND status='converged'
       AND (pair_id IS NULL OR pair_id='') ORDER BY store_product_id`,
    )
    .all()
    .map((r) => ({
      id: r.store_product_id,
      name: r.name,
      product_id: r.product_id,
      regular_price: r.regular_price,
    }))
  const categories = new Set([
    ...CATEGORIES,
    ...products.map((p) => p.category).filter(Boolean),
  ])
  return {
    batch: batchId(),
    created_at: now(),
    instacart_markup: compare.build(db).markup,
    rules: RULES,
    categories: [...categories].sort(),
    pending,
    products,
    costco_pairing: {
      unpaired_costco_receipt_items: unpairedCostco,
      unpaired_instacart_items: unpairedInstacart,
    },
    output_schema: OUTPUT_SCHEMA,
  }
}

const OUTPUT_SCHEMA = {
  batch: 'copy the batch id from the export',
  proposals: [
    {
      store: 'store of the pending item',
      store_product_id: 'id of the pending item',
      action: 'link | new | pair | ignore | ask',
      product_id: 'link/pair: existing product id',
      new_product:
        'new (or pair of two new items): {"name": "...", "category": "..."}',
      pair_with:
        'pair: {"store": "costco|instacart", "store_product_id": "..."}',
      candidates: 'ask: up to 3 existing product ids',
      size_text: 'optional: size used for price math',
      match_tier: 'exact | equivalent | substitute',
      note: 'optional short note shown on the compare page',
      preferred: 'optional bool: show this version first for its store',
      confidence: '0..1',
      reason: 'one short sentence',
    },
  ],
}

export function writeExport(db) {
  fs.mkdirSync(BATCH_DIR, { recursive: true })
  const data = exportBatch(db)
  const file = path.join(BATCH_DIR, `batch-${data.batch}.json`)
  fs.writeFileSync(file, JSON.stringify(data, null, 1))
  return { file: path.relative(ROOT, file), data }
}

// ---------- apply (validate + store proposals) ----------

const getItem = (db, store, pid) =>
  db
    .prepare('SELECT * FROM items WHERE store=? AND store_product_id=?')
    .get(store ?? null, String(pid ?? 'None'))

const getProduct = (db, pid) =>
  pid !== null &&
  pid !== undefined &&
  (typeof pid === 'number' || typeof pid === 'string')
    ? db.prepare('SELECT * FROM products WHERE id=?').get(pid)
    : undefined

/** Returns [normalized proposal, error]. A new-product name that already exists becomes a link. */
export function validate(db, p) {
  if (!p || typeof p !== 'object' || Array.isArray(p))
    return [null, 'not an object']
  const action = p.action ?? null
  if (!ACTIONS.has(action)) return [null, `bad action ${repr(action)}`]
  const store = p.store ?? null
  const pid = p.store_product_id ? String(p.store_product_id) : ''
  const it = getItem(db, store, pid)
  if (!it) return [null, `unknown item ${store ?? 'None'}/${pid}`]
  if (it.status !== 'pending')
    return [null, `item ${store}/${pid} is ${it.status}, not pending`]
  let conf
  try {
    conf = toFloat(p.confidence ?? 0)
  } catch {
    return [null, 'confidence must be a number']
  }
  const out = {
    store,
    store_product_id: pid,
    action,
    confidence: Math.max(0, Math.min(1, conf)),
    reason: String(p.reason || ''),
    size_text: p.size_text || null,
    match_tier: TIERS.has(p.match_tier) ? p.match_tier : null,
    note: p.note || null,
    preferred: Boolean(p.preferred),
  }

  if (action === 'new' || (action === 'pair' && p.new_product)) {
    const np = p.new_product || {}
    const name = String(np.name || '').trim()
    const cat = String(np.category || '').trim()
    if (!name || !cat) return [null, 'new_product needs name and category']
    const existing = db
      .prepare('SELECT id FROM products WHERE lower(name)=lower(?)')
      .get(name)
    if (existing) {
      out.product_id = existing.id
      if (action === 'new') out.action = 'link'
    } else {
      out.new_product = { name, category: cat }
    }
  }
  if (out.action === 'link' || (action === 'pair' && !('new_product' in out))) {
    const prodId = 'product_id' in out ? out.product_id : (p.product_id ?? null)
    if (!getProduct(db, prodId))
      return [null, `unknown product_id ${repr(prodId)}`]
    out.product_id = parseInt(prodId, 10)
  }
  if (action === 'pair') {
    const w = p.pair_with || {}
    const sides = new Set([store, w.store])
    if (sides.size !== 2 || !sides.has('costco') || !sides.has('instacart')) {
      return [null, 'pair must join a costco item and an instacart item']
    }
    const target = getItem(db, w.store, w.store_product_id)
    if (!target || target.status === 'ignored') {
      return [
        null,
        `pair target ${w.store ?? 'None'}/${w.store_product_id ?? 'None'} not found or ignored`,
      ]
    }
    out.pair_with = {
      store: w.store,
      store_product_id: String(w.store_product_id),
    }
  }
  if (action === 'ask') {
    out.candidates = (p.candidates || [])
      .slice(0, 3)
      .filter((c) => getProduct(db, c))
      .map((c) => parseInt(c, 10))
  }
  return [out, null]
}

export function apply(db, data) {
  const batch = String(data.batch || batchId())
  const report = { batch, stored: 0, invalid: [], by_action: {} }
  const supersede =
    db.prepare(`UPDATE proposals SET status='superseded', decided_at=? WHERE status='proposed'
                                AND store=? AND store_product_id=?`)
  const insert =
    db.prepare(`INSERT INTO proposals (batch, store, store_product_id, action, payload_json, confidence, reason,
                                                    status, created_at) VALUES (?,?,?,?,?,?,?,'proposed',?)`)
  for (const p of data.proposals || []) {
    const [norm, err] = validate(db, p)
    if (err) {
      report.invalid.push({ proposal: p, error: err })
      continue
    }
    supersede.run(now(), norm.store, norm.store_product_id)
    insert.run(
      batch,
      norm.store,
      norm.store_product_id,
      norm.action,
      JSON.stringify(norm),
      norm.confidence,
      norm.reason,
      now(),
    )
    report.stored += 1
    report.by_action[norm.action] = (report.by_action[norm.action] || 0) + 1
  }
  return report
}

// ---------- review: list / approve / reject ----------

export function listProposals(db, status = 'proposed') {
  const proposals = db
    .prepare(
      `SELECT p.*, i.name AS item_name, i.url AS item_url, i.image_url, i.last_price, i.times_seen
       FROM proposals p LEFT JOIN items i ON i.store=p.store AND i.store_product_id=p.store_product_id
       WHERE p.status=? ORDER BY p.action, p.confidence DESC, p.id`,
    )
    .all(status)
    .map(({ payload_json: payload, ...r }) => ({
      ...r,
      payload: JSON.parse(payload),
    }))
  const products = db
    .prepare(
      'SELECT id, name, category FROM products ORDER BY name COLLATE NOCASE',
    )
    .all()
  return { proposals, products, categories: CATEGORIES }
}

function link(db, store, pid, productId, p) {
  db.prepare(
    `UPDATE items SET product_id=?, status='converged', status_changed_at=?,
       size_text=COALESCE(?, size_text), match_tier=COALESCE(?, match_tier), note=COALESCE(?, note),
       preferred=CASE WHEN ? THEN 1 ELSE preferred END
     WHERE store=? AND store_product_id=?`,
  ).run(
    productId,
    now(),
    p.size_text ?? null,
    p.match_tier ?? null,
    p.note ?? null,
    p.preferred ? 1 : 0,
    store,
    pid,
  )
}

function ensureProduct(db, np) {
  db.prepare(
    'INSERT OR IGNORE INTO products (name, category, created_at) VALUES (?,?,?)',
  ).run(np.name, np.category, now())
  return db.prepare('SELECT id FROM products WHERE name=?').get(np.name).id
}

const EDITABLE = new Set([
  'action',
  'product_id',
  'new_product',
  'size_text',
  'match_tier',
  'note',
  'preferred',
  'pair_with',
  'choice',
])

export function approve(db, proposalId, edits = null) {
  const row = db
    .prepare("SELECT * FROM proposals WHERE id=? AND status='proposed'")
    .get(proposalId)
  if (!row) throw new ValueError('proposal not found or already decided')
  const p = JSON.parse(row.payload_json)
  for (const [k, v] of Object.entries(edits || {}))
    if (EDITABLE.has(k)) p[k] = v
  const { action } = p
  const markApproved = () =>
    db
      .prepare(
        "UPDATE proposals SET status='approved', decided_at=?, payload_json=? WHERE id=?",
      )
      .run(now(), JSON.stringify(p), proposalId)

  if (normalize.ACTIONS.has(action)) {
    normalize.approve(db, row, p) // normalize proposals: new store versions / not carried
    markApproved()
    return { approved: proposalId, action }
  }
  if (action === 'ask')
    throw new ValueError('choose link, new product or ignore before approving')
  if (action === 'ignore') {
    db.prepare(
      "UPDATE items SET status='ignored', status_changed_at=? WHERE store=? AND store_product_id=?",
    ).run(now(), row.store, row.store_product_id)
  } else {
    let productId
    if (p.new_product && (action === 'new' || action === 'pair')) {
      productId = ensureProduct(db, p.new_product)
    } else if (action === 'new') {
      throw new ValueError('new product needs a name and category')
    } else {
      productId = parseInt(p.product_id, 10)
      if (!getProduct(db, productId)) throw new ValueError('unknown product')
    }
    link(db, row.store, row.store_product_id, productId, p)
    if (action === 'pair') {
      const w = p.pair_with
      const other = getItem(db, w.store, w.store_product_id)
      if (other.status === 'pending' || other.product_id === null) {
        link(db, w.store, w.store_product_id, productId, {})
      }
      const [insta, costco] =
        row.store === 'instacart'
          ? [row.store_product_id, w.store_product_id]
          : [w.store_product_id, row.store_product_id]
      db.prepare(
        "UPDATE items SET pair_id=? WHERE store='instacart' AND store_product_id=?",
      ).run(costco, insta)
    }
  }
  markApproved()
  return { approved: proposalId, action }
}

export function reject(db, proposalId) {
  const n = db
    .prepare(
      "UPDATE proposals SET status='rejected', decided_at=? WHERE id=? AND status='proposed'",
    )
    .run(now(), proposalId).changes
  return { rejected: n }
}

export function approveBulk(db, minConfidence = 0.9) {
  const ids = db
    .prepare(
      `SELECT id FROM proposals WHERE status='proposed' AND action NOT IN ('ask', 'version_ask')
       AND confidence >= ? ORDER BY id`,
    )
    .all(minConfidence)
    .map((r) => r.id)
  let done = 0
  const errors = []
  for (const id of ids) {
    try {
      approve(db, id)
      done += 1
    } catch (e) {
      if (!(e instanceof ValueError)) throw e
      errors.push({ id, error: e.message })
    }
  }
  return { approved: done, errors }
}

/** Counts of proposals stored since `since` (ISO), by action: what a run produced. */
export function countNewProposals(db, since) {
  return Object.fromEntries(
    db
      .prepare(
        "SELECT action, COUNT(*) n FROM proposals WHERE status='proposed' AND created_at >= ? GROUP BY action",
      )
      .all(since)
      .map((r) => [r.action, r.n]),
  )
}
