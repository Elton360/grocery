/**
 * Normalize: find missing store versions of curated products (by browsing) → proposals for review.
 *
 * Proposal actions (stored in the shared `proposals` table):
 *   version      new store item for a product; proposals.store/store_product_id = the new item's ids
 *   not_carried  the store has no reasonable equivalent; store_product_id = 'product:<id>'
 *   version_ask  unclear / hard-requirement cases; the reviewer picks a candidate or not carried
 */
import * as compare from './compare.js'
import { RULES } from './rules.js'
import {
  ValueError,
  batchId,
  now,
  pyRound,
  repr,
  toFloat,
  today,
} from './util.js'

/** target store -> item store holding its versions */
export const TARGETS = { costco: 'instacart', aldi: 'aldi', walmart: 'walmart' }
const SEARCH_URL = {
  costco: 'https://www.instacart.com/store/costco/s?k={q}',
  aldi: 'https://www.aldi.us/store/aldi/s?k={q}',
  walmart: 'https://www.walmart.com/search?q={q}',
}
export const ACTIONS = new Set(['version', 'not_carried', 'version_ask'])
const PACING = [
  'Wait ~5 s between searches.',
  'Stop immediately on a 403, "request blocked" or captcha page: apply what is done and report. Never retry through a block.',
  'Aldi: stay in In-Store mode (shelf prices). If the header shows Pickup or Delivery, stop and report.',
]

function hasVersion(db, productId, target) {
  const stores =
    target === 'costco' ? ['costco', 'instacart'] : [TARGETS[target]]
  return Boolean(
    db
      .prepare(
        `SELECT 1 FROM items WHERE product_id=? AND status='converged' AND store IN (${stores.map(() => '?').join(',')})`,
      )
      .get(productId, ...stores),
  )
}

const openNormalizeProposals = (db) =>
  db
    .prepare(
      "SELECT id, payload_json FROM proposals WHERE status='proposed' AND action IN ('version','not_carried','version_ask') ORDER BY id",
    )
    .all()
    .map((r) => ({ id: r.id, payload: JSON.parse(r.payload_json) }))

export function queue(db, target) {
  const open = new Set(
    openNormalizeProposals(db).map(
      ({ payload }) => `${payload.product_id}:${payload.target}`,
    ),
  )
  const nc = new Set(
    db
      .prepare('SELECT product_id FROM not_carried WHERE store=?')
      .all(target)
      .map((r) => r.product_id),
  )
  return db
    .prepare(
      `SELECT p.id, p.name, p.category,
              (SELECT COALESCE(SUM(times_seen),0) FROM items i WHERE i.product_id=p.id) AS bought
       FROM products p ORDER BY bought DESC, p.name`,
    )
    .all()
    .filter(
      (r) =>
        !nc.has(r.id) &&
        !open.has(`${r.id}:${target}`) &&
        !hasVersion(db, r.id, target),
    )
}

export function exportBatch(db, target, limit = null) {
  if (!(target in TARGETS)) {
    const stores = Object.keys(TARGETS).sort().map(repr).join(', ')
    throw new ValueError(`store must be one of [${stores}]`)
  }
  let todo = queue(db, target)
  const total = todo.length
  if (limit) todo = todo.slice(0, limit)
  const versionsOf = db.prepare(
    "SELECT * FROM items WHERE product_id=? AND status='converged' ORDER BY rowid",
  )
  for (const p of todo) {
    p.spec_versions = versionsOf.all(p.id).map((r) => ({
      store: r.store,
      name: r.name,
      size_text: r.size_text,
      price: r.last_price,
      match_tier: r.match_tier,
      note: r.note,
    }))
  }
  return {
    batch: batchId(),
    created_at: now(),
    target_store: target,
    item_store: TARGETS[target],
    search_url: SEARCH_URL[target],
    queue_remaining: total,
    products: todo,
    instacart_markup: compare.build(db).markup,
    rules: RULES,
    pacing: PACING,
    output_schema: OUTPUT_SCHEMA,
  }
}

const OUTPUT_SCHEMA = {
  batch: 'copy from the export',
  proposals: [
    {
      product_id: 'product being filled',
      action: 'version | not_carried | version_ask',
      store_product_id: 'version: the store item id (from the product URL)',
      name: 'version: store item name',
      url: 'version: product URL',
      price: 'version: shelf price (Instacart: regular, non-promo price)',
      size_text:
        'version: size used for price math, e.g. "12 oz", "6-count", "1 lb"',
      match_tier: 'exact | equivalent | substitute',
      note: 'short note for the compare page',
      alternatives:
        'optional, up to 2: [{store_product_id, name, url, price, size_text}]',
      candidates:
        'version_ask: up to 3 candidates in the same shape as alternatives',
      confidence: '0..1',
      reason: 'one short sentence',
    },
  ],
}

function candidate(c) {
  if (!c || typeof c !== 'object') return null
  let price
  try {
    price = toFloat(c.price)
  } catch {
    return null
  }
  if (!c.store_product_id || !c.name || !(price > 0)) return null
  return {
    store_product_id: String(c.store_product_id),
    name: String(c.name),
    url: c.url || '',
    price: pyRound(price, 2),
    size_text: c.size_text || null,
  }
}

export function validate(db, target, p) {
  if (
    !p ||
    typeof p !== 'object' ||
    Array.isArray(p) ||
    !ACTIONS.has(p.action)
  ) {
    const shown =
      p && typeof p === 'object' && !Array.isArray(p) ? (p.action ?? null) : p
    return [null, `bad action ${repr(shown)}`]
  }
  const pid = p.product_id ?? null
  const prod =
    typeof pid === 'number' || typeof pid === 'string'
      ? db.prepare('SELECT id, name FROM products WHERE id=?').get(pid)
      : undefined
  if (!prod) return [null, `unknown product_id ${repr(pid)}`]
  const itemStore = TARGETS[target]
  let conf
  try {
    conf = Math.max(0, Math.min(1, toFloat(p.confidence ?? 0)))
  } catch {
    return [null, 'confidence must be a number']
  }
  const out = {
    action: p.action,
    product_id: prod.id,
    product_name: prod.name,
    target,
    item_store: itemStore,
    confidence: conf,
    reason: String(p.reason || ''),
    match_tier: ['exact', 'equivalent', 'substitute'].includes(p.match_tier)
      ? p.match_tier
      : null,
    note: p.note || null,
    checked_on: today(),
  }

  const statusOf = db.prepare(
    'SELECT status, product_id FROM items WHERE store=? AND store_product_id=?',
  )
  const unusable = (c) => {
    const row = statusOf.get(itemStore, c.store_product_id)
    if (row?.status === 'ignored')
      return `${itemStore}/${c.store_product_id} is on your ignore list`
    if (row?.status === 'converged')
      return `${itemStore}/${c.store_product_id} is already on the list`
    return null
  }
  const usable = (list, n) =>
    (Array.isArray(list) ? list : [])
      .slice(0, n)
      .map(candidate)
      .filter((c) => c && !unusable(c))

  if (p.action === 'version') {
    const main = candidate(p)
    if (!main)
      return [null, 'version needs store_product_id, name and a positive price']
    const err = unusable(main)
    if (err) return [null, err]
    Object.assign(out, main, { alternatives: usable(p.alternatives, 2) })
  } else if (p.action === 'version_ask') {
    out.candidates = usable(p.candidates, 3)
  }
  return [out, null]
}

export function apply(db, data) {
  const target = data.target_store || data.store
  if (!(target in TARGETS)) {
    throw new ValueError(
      'proposals file needs target_store (costco | aldi | walmart)',
    )
  }
  const batch = String(data.batch || batchId())
  const report = {
    batch,
    target_store: target,
    stored: 0,
    invalid: [],
    by_action: {},
  }
  const supersede = db.prepare(
    "UPDATE proposals SET status='superseded', decided_at=? WHERE id=?",
  )
  const insert =
    db.prepare(`INSERT INTO proposals (batch, store, store_product_id, action, payload_json, confidence, reason,
                                                    status, created_at) VALUES (?,?,?,?,?,?,?,'proposed',?)`)
  for (const p of data.proposals || []) {
    const [norm, err] = validate(db, target, p)
    if (err) {
      const isObj = p && typeof p === 'object' && !Array.isArray(p)
      report.invalid.push({
        product_id: isObj ? (p.product_id ?? null) : null,
        error: err,
      })
      continue
    }
    // one open normalize proposal per product and store
    for (const { id, payload } of openNormalizeProposals(db)) {
      if (payload.product_id === norm.product_id && payload.target === target)
        supersede.run(now(), id)
    }
    const isVersion = norm.action === 'version'
    insert.run(
      batch,
      isVersion ? norm.item_store : target,
      isVersion ? norm.store_product_id : `product:${norm.product_id}`,
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

/** Apply an approved normalize proposal. `p` is the payload after reviewer edits. */
export function approve(db, row, p) {
  const { action } = p
  if (action === 'version_ask')
    throw new ValueError('pick a candidate or "not carried" before approving')
  if (action === 'not_carried') {
    db.prepare(
      'INSERT OR REPLACE INTO not_carried (product_id, store, note, checked_on) VALUES (?,?,?,?)',
    ).run(p.product_id, p.target, p.note || 'not carried', p.checked_on ?? null)
    return
  }
  const choice = p.choice ?? null // index into alternatives/candidates chosen on the review page
  const pool = (p.alternatives?.length ? p.alternatives : p.candidates) || []
  if (choice !== null) {
    const i = parseInt(choice, 10)
    if (!(i >= 0 && i < pool.length)) throw new ValueError('invalid choice')
    Object.assign(p, pool[i])
  }
  const store = p.item_store
  const existing = db
    .prepare('SELECT status FROM items WHERE store=? AND store_product_id=?')
    .get(store, p.store_product_id)
  if (existing?.status === 'ignored')
    throw new ValueError('that store item is on your ignore list')
  const priceCol = store === 'instacart' ? 'regular_price' : 'last_price'
  if (existing) {
    db.prepare(
      `UPDATE items SET product_id=?, status='converged', status_changed_at=?, ${priceCol}=?,
         size_text=COALESCE(?, size_text), match_tier=COALESCE(?, match_tier), note=COALESCE(?, note),
         url=COALESCE(NULLIF(url,''), ?) WHERE store=? AND store_product_id=?`,
    ).run(
      p.product_id,
      now(),
      p.price,
      p.size_text ?? null,
      p.match_tier ?? null,
      p.note ?? null,
      p.url ?? null,
      store,
      p.store_product_id,
    )
  } else {
    db.prepare(
      `INSERT INTO items (store, store_product_id, name, url, product_id, status, status_changed_at,
                          ${priceCol}, last_seen, last_source, times_seen, size_text, match_tier, note)
       VALUES (?,?,?,?,?,'converged',?,?,?,'match',0,?,?,?)`,
    ).run(
      store,
      p.store_product_id,
      p.name,
      p.url ?? null,
      p.product_id,
      now(),
      p.price,
      p.checked_on ?? null,
      p.size_text ?? null,
      p.match_tier ?? null,
      p.note ?? null,
    )
  }
}
