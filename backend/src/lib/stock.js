/** Stock status of master items (In stock / Low / Out) and preferred store variants. */
import { ValueError, now } from './util.js'

export const STOCK = new Set(['in_stock', 'low', 'out'])
// compare-page store -> item stores holding its versions (Costco versions come from both)
const STORE_GROUP = {
  costco: ['costco', 'instacart'],
  instacart: ['costco', 'instacart'],
}

/** { [productId]: { status, changed_at } } for every product. */
export function stockMap(db) {
  return Object.fromEntries(
    db
      .prepare('SELECT id, stock_status, stock_changed_at FROM products')
      .all()
      .map((r) => [
        r.id,
        { status: r.stock_status, changed_at: r.stock_changed_at },
      ]),
  )
}

export function setStock(db, productId, status) {
  if (!STOCK.has(status)) throw new ValueError(`bad stock status ${status}`)
  const at = now()
  const n = db
    .prepare(
      'UPDATE products SET stock_status=?, stock_changed_at=? WHERE id=?',
    )
    .run(status, at, productId).changes
  if (!n) throw new ValueError('unknown product')
  db.prepare(
    'INSERT INTO stock_events (product_id, status, at) VALUES (?,?,?)',
  ).run(productId, status, at)
  return { id: productId, status, changed_at: at }
}

/** Star/unstar a variant; one preferred variant per product per store (Costco + Instacart count as one). */
export function setPreferred(db, store, storeProductId, preferred) {
  const it = db
    .prepare(
      "SELECT product_id FROM items WHERE store=? AND store_product_id=? AND status='converged'",
    )
    .get(store, storeProductId)
  if (!it) throw new ValueError('item not found on the list')
  if (preferred) {
    const group = STORE_GROUP[store] ?? [store]
    db.prepare(
      `UPDATE items SET preferred=0 WHERE product_id=? AND store IN (${group.map(() => '?').join(',')})`,
    ).run(it.product_id, ...group)
  }
  db.prepare(
    'UPDATE items SET preferred=? WHERE store=? AND store_product_id=?',
  ).run(preferred ? 1 : 0, store, storeProductId)
  return {
    store,
    store_product_id: storeProductId,
    preferred: Boolean(preferred),
  }
}
