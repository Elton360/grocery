/** Grabs (carts, orders, receipts) → observations + pending items; the ignore list; item status. */
import crypto from 'node:crypto'

import { marks } from '../db.js'

import { ValueError, now, today } from './util.js'

export const STORES = new Set(['walmart', 'costco', 'instacart', 'aldi'])
export const SOURCES = new Set(['cart', 'order', 'receipt', 'seed'])

/** Store product id, or a name-derived fallback when a page exposes no id. */
export function itemKey(it) {
  const pid = String(it.store_product_id || '').trim()
  if (pid) return pid
  const slug = (it.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `name:${slug}`
}

export function statusOf(db, store, ids) {
  const rows = ids.length
    ? db
        .prepare(
          `SELECT store_product_id, status FROM items WHERE store=? AND store_product_id IN (${marks(ids.length)})`,
        )
        .all(store, ...ids)
    : []
  const found = new Map(rows.map((r) => [r.store_product_id, r.status]))
  return Object.fromEntries(ids.map((i) => [i, found.get(i) ?? 'new']))
}

export function ignoreItems(db, store, items) {
  const stmt = db.prepare(`
    INSERT INTO items (store, store_product_id, name, size_text, url, image_url, status, status_changed_at)
    VALUES (?,?,?,?,?,?, 'ignored', ?)
    ON CONFLICT(store, store_product_id) DO UPDATE SET status='ignored', status_changed_at=excluded.status_changed_at`)
  for (const it of items) {
    stmt.run(
      store,
      itemKey(it),
      it.name ?? null,
      it.size_text ?? null,
      it.url ?? null,
      it.image_url ?? null,
      now(),
    )
  }
  return items.length
}

/**
 * Identity of a grab so re-submitting it replaces the earlier one. Orders are keyed by their page; carts and
 * receipts by the side panel's capture id when given (the panel re-submits a capture as more of its items are
 * added), else receipts by date + item numbers. Carts without a capture id are never deduped.
 */
export function orderKey(store, source, orderDate, pageUrl, items, captureKey) {
  if (source === 'order' && pageUrl) return `${store}:${pageUrl}`
  if (captureKey) return `${store}:capture:${captureKey}`
  if (source === 'receipt') {
    const ids = items
      .filter((i) => i.store_product_id)
      .map((i) => String(i.store_product_id))
      .sort()
    const hash = crypto
      .createHash('sha1')
      .update(ids.join(','))
      .digest('hex')
      .slice(0, 12)
    return `${store}:receipt:${orderDate}:${hash}`
  }
  return null
}

/** Rebuild seen/price stats of items from their observations (after a grab is added or replaced). */
function recompute(db, store, keys) {
  const select = db.prepare(`
    SELECT o.price_each, g.order_date, g.source, g.price_mode FROM observations o JOIN grabs g ON g.id = o.grab_id
    WHERE o.store=? AND o.store_product_id=? ORDER BY g.order_date, g.id, o.id`)
  const update = db.prepare(`
    UPDATE items SET times_seen=?, first_seen=?, last_seen=?, last_price=COALESCE(?, last_price), last_source=?
    WHERE store=? AND store_product_id=?`)
  for (const k of keys) {
    const obs = select.all(store, k)
    if (!obs.length) continue
    const priced = obs.filter((o) => o.price_mode !== 'pickup') // pickup prices never become the item's price
    update.run(
      obs.length,
      obs[0].order_date,
      obs.at(-1).order_date,
      priced.length ? priced.at(-1).price_each : null,
      obs.at(-1).source,
      store,
      k,
    )
  }
}

export function saveGrab(db, payload) {
  const { store, source } = payload
  if (!STORES.has(store) || !SOURCES.has(source)) {
    throw new ValueError(
      `bad store/source: ${store ?? 'None'}/${source ?? 'None'}`,
    )
  }
  const orderDate = payload.order_date || today()
  const removed = ignoreItems(db, store, payload.removed || [])
  const items = payload.items || []
  const touched = new Set()

  const k = orderKey(
    store,
    source,
    orderDate,
    payload.page_url,
    items,
    payload.capture_key,
  )
  let replaced = false
  if (k) {
    for (const old of db
      .prepare('SELECT id FROM grabs WHERE order_key=?')
      .all(k)) {
      for (const r of db
        .prepare('SELECT store_product_id FROM observations WHERE grab_id=?')
        .all(old.id)) {
        touched.add(r.store_product_id)
      }
      db.prepare('DELETE FROM observations WHERE grab_id=?').run(old.id)
      db.prepare('DELETE FROM grabs WHERE id=?').run(old.id)
      replaced = true
    }
  }

  const grabId = Number(
    db
      .prepare(
        'INSERT INTO grabs (store, source, order_date, captured_at, page_url, order_key, price_mode) VALUES (?,?,?,?,?,?,?)',
      )
      .run(
        store,
        source,
        orderDate,
        now(),
        payload.page_url ?? null,
        k,
        payload.price_mode ?? null,
      ).lastInsertRowid,
  )
  const counts = { new: 0, known: 0, ignored: 0, removed }
  const getStatus = db.prepare(
    'SELECT status FROM items WHERE store=? AND store_product_id=?',
  )
  const insertItem = db.prepare(`
    INSERT INTO items (store, store_product_id, name, size_text, url, image_url, status, status_changed_at)
    VALUES (?,?,?,?,?,?,'pending',?)`)
  const fillLinks = db.prepare(`
    UPDATE items SET url=COALESCE(NULLIF(url,''), ?), image_url=COALESCE(NULLIF(image_url,''), ?)
    WHERE store=? AND store_product_id=?`)
  const insertObs = db.prepare(`
    INSERT INTO observations (grab_id, store, store_product_id, name, size_text, qty, price_each, line_total,
                              unit_price_text, url, image_url, notes, raw_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  for (const it of items) {
    const pid = itemKey(it)
    const row = getStatus.get(store, pid)
    if (row?.status === 'ignored') {
      counts.ignored += 1
      continue
    }
    if (row) {
      counts.known += 1
    } else {
      counts.new += 1
      insertItem.run(
        store,
        pid,
        it.name ?? null,
        it.size_text ?? null,
        it.url ?? null,
        it.image_url ?? null,
        now(),
      )
    }
    fillLinks.run(it.url ?? null, it.image_url ?? null, store, pid)
    insertObs.run(
      grabId,
      store,
      pid,
      it.name ?? null,
      it.size_text ?? null,
      it.qty ?? null,
      it.price_each ?? null,
      it.line_total ?? null,
      it.unit_price_text ?? null,
      it.url ?? null,
      it.image_url ?? null,
      it.notes ?? null,
      it.raw !== undefined && it.raw !== null ? JSON.stringify(it.raw) : null,
    )
    touched.add(pid)
  }
  recompute(db, store, touched)
  return { grab_id: grabId, replaced, ...counts }
}

export function listItems(db, status) {
  return db
    .prepare(
      `SELECT i.*, p.name AS product_name, p.category FROM items i LEFT JOIN products p ON p.id = i.product_id
       WHERE i.status=? ORDER BY i.store, COALESCE(p.name, i.name) COLLATE NOCASE`,
    )
    .all(status)
}

/** remove -> ignored; restore -> back on the curated list if it has a product, else pending. */
export function setStatus(db, store, pid, action) {
  const status =
    action === 'remove'
      ? "'ignored'"
      : "CASE WHEN product_id IS NULL THEN 'pending' ELSE 'converged' END"
  return db
    .prepare(
      `UPDATE items SET status=${status}, status_changed_at=? WHERE store=? AND store_product_id=?`,
    )
    .run(now(), store, pid).changes
}
