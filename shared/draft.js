/**
 * Drafting engine for the grocery list: assigns Low/Out items to stores. Every strategy card, resolution
 * option and the auto-balanced view is `buildDraft` with different inputs (Draft page spec §4).
 * Pure functions over /api/compare products + the stock map.
 */
import { STORES, priceState } from './prices.js'

const round2 = (x) => Math.round(x * 100) / 100
const BALANCE_MOVE = 0.1 // move off the anchor store only when ≥10% cheaper elsewhere

/** Versions of a product at a store that have a current price. */
function priced(product, store) {
  return product.stores[store].versions.filter(
    (v) => !priceState(v).stale && Number(v.price) > 0,
  )
}

/** Best version at a store: the preferred one when honoring preferences, else the cheapest. */
function bestAt(product, store, honor) {
  const vs = priced(product, store)
  if (!vs.length) return null
  const pref = vs.find((v) => v.preferred)
  if (honor && pref) return { v: pref, preferred: true }
  const v = vs.reduce((a, b) => (Number(a.price) <= Number(b.price) ? a : b))
  return { v, preferred: Boolean(v.preferred) }
}

/** Low/Out items with their quantity (default 1). */
export function draftItems(products, stock, qty = {}) {
  return products
    .filter((p) => ['low', 'out'].includes(stock[p.id]?.status))
    .map((p) => ({
      product: p,
      status: stock[p.id].status,
      qty: Math.max(1, qty[p.id] ?? 1),
    }))
}

function line(item, store, pick, reason, extra = {}) {
  const unit = Number(pick.v.price)
  return {
    itemId: item.product.id,
    name: item.product.name,
    category: item.product.category,
    status: item.status,
    qty: item.qty,
    store,
    variant: pick.v,
    unitPrice: unit,
    lineTotal: round2(unit * item.qty),
    reason,
    preferred: pick.preferred,
    ...extra,
  }
}

/** Assign every item within one store set. `anchor` turns on auto-balancing around that store. */
function assign(items, set, honor, anchor) {
  const lines = []
  for (const item of items) {
    const options = set
      .map((s) => [s, bestAt(item.product, s, honor)])
      .filter(([, pick]) => pick)
    const anywhere = STORES.some((s) => priced(item.product, s).length)
    if (!options.length) {
      lines.push({
        itemId: item.product.id,
        name: item.product.name,
        category: item.product.category,
        status: item.status,
        qty: item.qty,
        reason: anywhere ? 'missing' : 'no_price',
      })
      continue
    }
    const cheapest = options.reduce((a, b) =>
      Number(a[1].v.price) <= Number(b[1].v.price) ? a : b,
    )
    const savesVs = (store, pick) => {
      const others = options.filter(([s]) => s !== store)
      if (!others.length) return undefined
      const next = Math.min(...others.map(([, o]) => Number(o.v.price)))
      const amount = round2((next - Number(pick.v.price)) * item.qty)
      return amount > 0 ? amount : undefined
    }

    if (anchor && set.includes(anchor)) {
      const atAnchor = options.find(([s]) => s === anchor)
      const prefElsewhere =
        honor && options.find(([s, p]) => s !== anchor && p.preferred)
      if (!atAnchor) {
        const [s, p] = prefElsewhere || cheapest
        lines.push(line(item, s, p, 'gap', { savesVs: savesVs(s, p) }))
      } else if (prefElsewhere && !atAnchor[1].preferred) {
        const [s, p] = prefElsewhere
        lines.push(line(item, s, p, 'preferred', { moved: true }))
      } else {
        const [cs, cp] = cheapest
        const anchorPrice = Number(atAnchor[1].v.price)
        if (
          cs !== anchor &&
          Number(cp.v.price) <= anchorPrice * (1 - BALANCE_MOVE)
        ) {
          lines.push(
            line(item, cs, cp, 'cheapest', {
              moved: true,
              savesVs: savesVs(cs, cp),
            }),
          )
        } else {
          const reason = atAnchor[1].preferred && honor ? 'preferred' : 'anchor'
          lines.push(line(item, anchor, atAnchor[1], reason))
        }
      }
      continue
    }

    const pref = honor && options.find(([, p]) => p.preferred)
    const [s, p] = pref || cheapest
    lines.push(
      line(item, s, p, pref ? 'preferred' : 'cheapest', {
        savesVs: savesVs(s, p),
      }),
    )
  }
  return lines
}

function summarize(lines, set, anchor) {
  const assigned = lines.filter((l) => l.store)
  const used = new Set(assigned.map((l) => l.store))
  const order = [
    ...(anchor ? [anchor] : []),
    ...set.filter((s) => s !== anchor),
  ]
  return {
    lines,
    stores: order.filter((s) => used.has(s)),
    total: round2(assigned.reduce((sum, l) => sum + l.lineTotal, 0)),
    units: lines.reduce((sum, l) => sum + l.qty, 0),
    missing: lines.filter((l) => l.reason === 'missing').map((l) => l.itemId),
    noPrice: lines.filter((l) => l.reason === 'no_price').map((l) => l.itemId),
  }
}

function subsets(stores, max) {
  const out = []
  const n = stores.length
  for (let mask = 1; mask < 1 << n; mask++) {
    const set = stores.filter((_, i) => mask & (1 << i))
    if (set.length <= max) out.push(set)
  }
  return out
}

/**
 * DraftInput → DraftResult. With maxStores below the allowed count, tries every store subset and keeps
 * the one with the fewest missing items, then the lowest total, then the fewest stores.
 */
export function buildDraft({
  items,
  allowedStores = STORES,
  maxStores = Infinity,
  honorPreferences = false,
  anchorStore,
}) {
  const sets =
    maxStores >= allowedStores.length
      ? [allowedStores]
      : subsets(allowedStores, maxStores)
  let best = null
  for (const set of sets) {
    const r = summarize(
      assign(items, set, honorPreferences, anchorStore),
      set,
      anchorStore,
    )
    const better =
      !best ||
      r.missing.length < best.missing.length ||
      (r.missing.length === best.missing.length &&
        (r.total < best.total ||
          (r.total === best.total && r.stores.length < best.stores.length)))
    if (better) best = r
  }
  return best
}

/** The store that covers the most items, then the cheapest: default for the One Store card. */
export function bestSingleStore(items, stores = STORES) {
  return stores
    .map((s) => [s, buildDraft({ items, allowedStores: [s] })])
    .sort(
      ([, a], [, b]) =>
        a.missing.length - b.missing.length || a.total - b.total,
    )[0][0]
}

/** The four strategy cards. */
export function strategies(items, oneStore) {
  return {
    cheapest: buildDraft({ items }),
    preferences: buildDraft({ items, honorPreferences: true }),
    one: buildDraft({ items, allowedStores: [oneStore], maxStores: 1 }),
    two: buildDraft({ items, maxStores: 2 }),
  }
}

/**
 * Ways to cover what the anchor store lacks: A = add the one store that fills the most gaps cheapest
 * (auto-balanced), B = best of all stores (auto-balanced around the anchor), C = leave them off.
 */
export function resolutions(items, anchor, stores = STORES) {
  const base = buildDraft({ items, allowedStores: [anchor], maxStores: 1 })
  const balanced = (allowed) =>
    buildDraft({
      items,
      allowedStores: allowed,
      honorPreferences: true,
      anchorStore: anchor,
    })
  const adds = stores
    .filter((s) => s !== anchor)
    .map((s) => ({ store: s, result: balanced([anchor, s]) }))
    .sort(
      (a, b) =>
        a.result.missing.length - b.result.missing.length ||
        a.result.total - b.result.total,
    )
  const add = adds[0]
  const all = balanced([anchor, ...stores.filter((s) => s !== anchor)])
  const covered = (r) =>
    base.missing.filter((id) => !r.missing.includes(id)).length
  return {
    base,
    addStore: add && {
      store: add.store,
      result: add.result,
      delta: round2(add.result.total - base.total),
      covers: covered(add.result),
    },
    bestOfAll: {
      result: all,
      delta: round2(all.total - base.total),
      covers: covered(all),
    },
    leaveOff: { result: base, delta: 0 },
  }
}

/** Cheapest single store that covers every priced item (for the savings card), or null. */
export function cheapestFullSingle(items, stores = STORES) {
  const full = stores
    .map((s) => ({
      store: s,
      result: buildDraft({ items, allowedStores: [s] }),
    }))
    .filter((x) => !x.result.missing.length)
    .sort((a, b) => a.result.total - b.result.total)
  return full[0] ?? null
}

/** Re-run with the store set locked (quantity edits in the balanced view). */
export function rebalanceLocked(items, prev, anchor) {
  return buildDraft({
    items,
    allowedStores: prev.stores.length ? prev.stores : [anchor],
    honorPreferences: true,
    anchorStore: anchor,
  })
}
